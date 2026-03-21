import { generateText, streamText, ModelMessage, stepCountIs } from "ai";
import { Response } from "express";
import { env } from "../../config/env";
import { aiModel, AI_CONFIG } from "../../ai/config/ai.config";
import { descubrirEsquemaBD, invalidarCache } from "../../agent/discovery/schema-discovery.service";
import { descubrirEsquemaAPI, invalidarCacheAPI } from "../../agent/discovery/openapi-discovery.service";
import { construirSystemPrompt } from "../../agent/context/context-builder.service";
import { sqlExecutorTool } from "../../agent/tools/sql-executor.tool";
import { apiExecutorTool } from "../../agent/tools/api-executor.tool";
import { usuarioExecutorTool } from "../../agent/tools/usuario-executor.tool";
import * as fs from 'fs';
import * as path from 'path';

let systemPrompt: string | null = null;
export let listo: boolean = false;

function getTools(): Record<string, any> {
  const tools: Record<string, any> = {};
  const modo = env.agent.mode;
  if (modo === "db" || modo === "both") {
    tools.ejecutarSQL = sqlExecutorTool;
    tools.gestionarUsuario = usuarioExecutorTool;
  }
  if (modo === "api" || modo === "both") {
    tools.ejecutarLlamadaAPI = apiExecutorTool;
  }
  return tools;
}

const CACHE_PATH = path.join(process.cwd(), '.schema-cache.json');

interface SchemaCache {
  systemPrompt: string;
  generadoEn: string;
  modo: string;
}

function leerCache(): string | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
    const cache = JSON.parse(raw) as SchemaCache;
    const hace1hora = Date.now() - 60 * 60 * 1000;
    if (new Date(cache.generadoEn).getTime() < hace1hora) {
      console.log(`[Cache] Expirado, regenerando...`);
      return null;
    }
    if (cache.modo !== env.agent.mode) {
      console.log(`[Cache] Modo cambio, regenerando...`);
      return null;
    }
    return cache.systemPrompt;
  } catch {
    return null;
  }
}

function guardarCache(prompt: string): void {
  try {
    const cache: SchemaCache = {
      systemPrompt: prompt,
      generadoEn: new Date().toISOString(),
      modo: env.agent.mode,
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
  } catch {
    // Si falla el cache no es critico
  }
}

export async function inicializarAgente(): Promise<void> {
  if (listo) return;
  console.log(`[${env.agent.name}] Estoy iniciando en modo: ${env.agent.mode.toUpperCase()}`);
  const cached = leerCache();
  if (cached) {
    systemPrompt = cached;
    listo = true;
    console.log(`[${env.agent.name}] Cache cargado (${systemPrompt.length} chars) — BD no consultada\n`);
    return;
  }
  const modo = env.agent.mode;
  const esquemaBD = modo === "db" || modo === "both" ? await descubrirEsquemaBD() : undefined;
  const esquemaAPI = modo === "api" || modo === "both" ? await descubrirEsquemaAPI() : undefined;
  systemPrompt = construirSystemPrompt(esquemaBD, esquemaAPI);
  guardarCache(systemPrompt);
  listo = true;
  console.log(`[${env.agent.name}] OK System prompt: ${systemPrompt.length} caracteres\n`);
}

export async function reiniciarAgente(): Promise<void> {
  if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);
  invalidarCache();
  invalidarCacheAPI();
  listo = false;
  systemPrompt = null;
  await inicializarAgente();
}

function verificar(): void {
  if (!listo || !systemPrompt)
    throw new Error("Agente no inicializado. Llama inicializarAgente() al arrancar.");
}

// Respuesta completa (sin streaming)
export async function consultarAgente(
  pregunta: string,
  historial: ModelMessage[] = [],
): Promise<{ texto: string; tokens: number; tiempoMs: number }> {
  verificar();
  const inicio = Date.now();
  const resultado = await generateText({
    model: aiModel,
    system: systemPrompt!,
    messages: [...historial, { role: "user", content: pregunta }],
    tools: getTools(),
    stopWhen: stepCountIs(10),
    maxOutputTokens: AI_CONFIG.maxTokens,
    temperature: AI_CONFIG.temperature,
    onStepFinish: ({ toolCalls }) => {
      toolCalls?.forEach((tc) => console.log(`[Agente] Tool: ${tc.toolName}`));
    },
  });
  return {
    texto: resultado.text,
    tokens: resultado.totalUsage.totalTokens ?? 0,
    tiempoMs: Date.now() - inicio,
  };
}

// Respuesta con streaming
export async function consultarAgenteStreaming(
  pregunta: string,
  res: Response,
  historial: ModelMessage[] = [],
): Promise<void> {
  verificar();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const originalConsoleError = console.error;
  console.error = () => { };

  try {
    const resultado = streamText({
      model: aiModel,
      system: systemPrompt!,
      messages: [...historial, { role: "user", content: pregunta }],
      tools: getTools(),
      stopWhen: stepCountIs(10),
      maxOutputTokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
    });

    // Acumular todo el texto — procesarlo solo en finish
    let textoCompleto = '';

    for await (const parte of resultado.fullStream) {

      if (parte.type === 'text-delta') {
        // Solo acumular — NO enviar todavia
        textoCompleto += parte.text || '';
      }

      if (parte.type === 'tool-call') {
        res.write(`data: ${JSON.stringify({ tipo: 'tool', nombre: parte.toolName })}\n\n`);
      }

      if (parte.type === 'error') {
        const msg = (parte as any).error?.message?.toLowerCase() || '';
        const esRateLimit =
          msg.includes('quota') ||
          msg.includes('429') ||
          msg.includes('resource_exhausted');
        res.write(`data: ${JSON.stringify({
          tipo: 'error',
          mensaje: esRateLimit
            ? 'Limite de consultas alcanzado. Espera unos minutos.'
            : 'Error procesando la consulta.',
        })}\n\n`);
      }

      if (parte.type === 'finish') {

        // Nuevo patron de exportacion — contiene SQL en lugar de tabla markdown
        // Formato: |||EXPORT_SQL:formato:titulo|||SQL|||END_EXPORT_SQL|||
        const exportRegex = /\|\|\|EXPORT_SQL:(pdf|xlsx|csv):([^\|]+)\|\|\|([\s\S]*?)\|\|\|END_EXPORT_SQL\|\|\|/i;
        const match = textoCompleto.match(exportRegex);
        if (match) {
          const formato = match[1].toLowerCase().trim();
          const titulo = match[2].trim();
          const sql = match[3].trim();
          // Texto antes del patron (si hay algo)
          const textoPrevio = textoCompleto.slice(0, match.index).trim();
          if (textoPrevio) {
            res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: textoPrevio })}\n\n`);
          }

          // Construir la URL del endpoint de exportacion
          // El frontend la usara para descargar el archivo directamente
          const sqlEncoded = encodeURIComponent(sql);
          const tituloEncoded = encodeURIComponent(titulo);
          const urlExport = `/api/export?sql=${sqlEncoded}&formato=${formato}&titulo=${tituloEncoded}`;

          // Emitir evento export_url al frontend
          // El frontend hara fetch a esta URL para descargar el archivo
          res.write(`data: ${JSON.stringify({ tipo: 'export_url', url: urlExport, formato: formato, titulo: titulo, })}\n\n`);

          // Texto despues del patron (mensaje de confirmacion del agente)
          const textoPost = textoCompleto.slice(match.index! + match[0].length).trim();
          if (textoPost) {
            res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: textoPost })}\n\n`);
          }
        } else {

          // Sin exportacion — enviar el texto completo como respuesta normal
          if (textoCompleto.trim()) {
            res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: textoCompleto })}\n\n`);
          }
        }

        // Siempre enviar el evento fin con el total de tokens usados
        res.write(`data: ${JSON.stringify({ tipo: 'fin', tokens: parte.totalUsage.totalTokens ?? 0, })}\n\n`);
      }
    }
    console.error = originalConsoleError;

  } catch (e: any) {
    console.error = originalConsoleError;
    const msg = e?.message?.toLowerCase() || '';
    const esRateLimit =
      msg.includes('quota') ||
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('maxretriesexceeded');
    res.write(`data: ${JSON.stringify({
      tipo: 'error',
      mensaje: esRateLimit
        ? 'Limite de consultas alcanzado. Espera unos minutos e intenta de nuevo.'
        : 'Error procesando la consulta.',
    })}\n\n`);
  } finally {
    console.error = originalConsoleError;
    res.end();
  }
}

export function obtenerEstado() {
  return {
    listo,
    modo: env.agent.mode,
    nombre: env.agent.name,
    promptLength: systemPrompt?.length || 0,
  };
}