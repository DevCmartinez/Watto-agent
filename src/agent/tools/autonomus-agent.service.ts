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

/**
 * @origin [src/agent/tools/autonomus-agent.service.ts]
 * @calledBy [src/controllers/agent.controller.ts] y [src/app.ts]
 * @description Lógica central del Agente. Maneja el descubrimiento de esquemas,
 * la creación del sistema de prompts y la interacción con modelos de IA (OpenAI/Google).
 */
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

/**
 * @name inicializarAgente
 * @calledBy [src/app.ts] durante el arranque del servidor.
 * @description Carga el cache del esquema de BD o lo genera rascando tablas y APIs.
 */
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
/**
 * @name consultarAgenteStreaming
 * @calledBy [src/controllers/agent.controller.ts] vía endpoint `/api/agent/stream`.
 * @description Procesa una pregunta del usuario, ejecuta tools (si es necesario) 
 * y devuelve la respuesta en modo streaming al frontend via SSE.
 */
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
      system: systemPrompt! + "\n\nNOTA: Si los datos son muy extensos, sugiere opcionalmente la exportación a Excel/PDF para mejor visualización.",
      messages: [...historial, { role: "user", content: pregunta }],
      tools: getTools(),
      stopWhen: stepCountIs(10),
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

    let textoAcumulado = '';
    let bloqueTecnicoAbierto = false;

    for await (const parte of resultado.fullStream) {
      if (parte.type === 'text-delta') {
        const chunk = parte.text || '';
        textoAcumulado += chunk;

        // Solo ocultamos del streaming si detectamos el inicio del bloque de exportación
        if (chunk.includes('|||')) bloqueTecnicoAbierto = true;

        if (!bloqueTecnicoAbierto) {
          res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk })}\n\n`);
        }
      }

      if (parte.type === 'tool-call') {
        res.write(`data: ${JSON.stringify({ tipo: 'tool', nombre: parte.toolName })}\n\n`);
      }

      if (parte.type === 'finish') {
        // Detección final de exportación en todo el texto acumulado
        const exportRegex = /\|\|\|EXPORT_SQL:(pdf|xlsx|csv):([^\|]+)\|\|\|([\s\S]*?)\|\|\|END_EXPORT_SQL\|\|\|/i;
        const match = textoAcumulado.match(exportRegex);

        // ■■ Deteccion de IMPORTACION (nuevo) ■■■■■■■■■■■■■■■■■■■■■
        const importRegex = /\|\|\|IMPORT_MAP:(bd|api):([^\|]+)\|\|\|?([\s\S]*?)?\|\|\|END_IMPORT_MAP\|\|\|/i;
        const matchImport = textoAcumulado.match(importRegex);


        if (match) {
          const formato = match[1].toLowerCase().trim();
          const titulo = match[2].trim();
          const sql = match[3].trim();
          const urlExport = `/api/export?sql=${encodeURIComponent(sql)}&formato=${formato}&titulo=${encodeURIComponent(titulo)}`;

          res.write(`data: ${JSON.stringify({ tipo: 'export_url', url: urlExport, formato, titulo })}\n\n`);

          // Enviar texto sobrante que no se haya streameado
          const textoPost = textoAcumulado.split('|||END_EXPORT_SQL|||')[1]?.trim();
          if (textoPost) res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: '\n\n' + textoPost })}\n\n`);
        } else if (matchImport) {

          // Hay un mapeo de importacion generado por el agente
          const destino = matchImport[1].toLowerCase() as 'bd' | 'api';
          const tablaOEndpoint = matchImport[2].trim();
          const mapeoJson = matchImport[3].trim();

          // Texto antes del patron
          const textoPrevio = textoAcumulado.slice(0, matchImport.index).trim();
          if (textoPrevio && bloqueTecnicoAbierto) {
            // Si estaba oculto pero hay texto antes del match, lo enviamos (aunque es raro en este flujo)
          }

          try {
            // Parsear el JSON del mapeo generado por el agente
            const mapeo = JSON.parse(mapeoJson);
            // Emitir evento import_ready al frontend
            res.write(`data: ${JSON.stringify({
              tipo: 'import_ready',
              destino,
              tabla: destino === 'bd' ? tablaOEndpoint : undefined,
              endpoint: destino === 'api' ? tablaOEndpoint : undefined,
              mapeo,
            })}\n\n`);
          } catch (e) {
            res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: '\n\nError al procesar el mapeo de importación.\n' })}\n\n`);
          }

          // Texto después del patrón
          const textoPost = textoAcumulado.slice((matchImport.index || 0) + matchImport[0].length).trim();
          if (textoPost) res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: '\n\n' + textoPost })}\n\n`);
        }
        else if (bloqueTecnicoAbierto) {
          // Si abrimos bloque pero no cerramos o no era export, mandamos el resto
          res.write(`data: ${JSON.stringify({ tipo: 'texto', chunk: textoAcumulado.slice(textoAcumulado.indexOf('|||')) })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ tipo: 'fin', tokens: parte.totalUsage.totalTokens ?? 0 })}\n\n`);
      }
    }

    console.error = originalConsoleError;

  } catch (e: any) {
    console.error = originalConsoleError;
    const msg = e?.message?.toLowerCase() || '';
    const esRateLimit = msg.includes('quota') || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('maxretriesexceeded');

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