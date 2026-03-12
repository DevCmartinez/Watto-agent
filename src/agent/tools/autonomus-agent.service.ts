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

//Ruta del archivo cache (Estamos manejando cache del system prompt en disco)
const CACHE_PATH = path.join(process.cwd(), '.schema-cache.json');

// Estructura del cache
interface SchemaCache {
  systemPrompt: string;
  generadoEn: string; // ISO date
  modo: string;
}

// Leer cache si existe y es reciente (menos de 1 hora)
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

// Guardar cache en disco
function guardarCache(prompt: string): void {
  try {
    const cache: SchemaCache = {
      systemPrompt: prompt,
      generadoEn: new Date().toISOString(),
      modo: env.agent.mode,
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
  } catch {
    // Si falla el cache no es critico, continuar normal
  }
}

// Llamar una vez al arrancar el servidor
export async function inicializarAgente(): Promise<void> {

  if (listo) return;
  console.log(
    `[${env.agent.name}] Estoy iniciando en modo: ${env.agent.mode.toUpperCase()}`,
  );

  // Intentar cargar desde cache
  const cached = leerCache();
  if (cached) {
    systemPrompt = cached;
    listo = true;
    console.log(`[${env.agent.name}] Cache cargado (${systemPrompt.length} chars) — BD no consultada\n`);
    return;
  }

  const modo = env.agent.mode;
  const esquemaBD =
    modo === "db" || modo === "both" ? await descubrirEsquemaBD() : undefined;
  const esquemaAPI =
    modo === "api" || modo === "both" ? await descubrirEsquemaAPI() : undefined;

  systemPrompt = construirSystemPrompt(esquemaBD, esquemaAPI);
  // Guardar cache
  guardarCache(systemPrompt);
  listo = true;
  console.log(`[${env.agent.name}] OK System prompt: ${systemPrompt.length} caracteres
`);
}

/**
 * Reinicia el agente borrando el cache en disco y memoria.
 */
export async function reiniciarAgente(): Promise<void> {
  if (fs.existsSync(CACHE_PATH)) {
    fs.unlinkSync(CACHE_PATH);
  }
  invalidarCache(); // DB schema cache
  invalidarCacheAPI(); // API schema cache
  listo = false;
  systemPrompt = null;
  await inicializarAgente();
}

function verificar(): void {
  if (!listo || !systemPrompt)
    throw new Error(
      "Agente no inicializado. Llama inicializarAgente() al arrancar.",
    );
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

  // Silenciar console.error del SDK durante el streaming
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
    for await (const parte of resultado.fullStream) {
      // console.log("[STREAM]", parte.type); // <- agregar esta línea

      if (parte.type === "text-delta")
        res.write(
          `data: ${JSON.stringify({ tipo: "texto", chunk: parte.text })}\n\n`,
        );
      if (parte.type === "tool-call")
        res.write(
          `data: ${JSON.stringify({ tipo: "tool", nombre: parte.toolName })}\n\n`,
        );
      if (parte.type === "error") {
        // console.log("[TOOL ERROR]", (parte as any).error);

        // El SDK emite un evento tipo "error" dentro del stream
        const msg = (parte as any).error?.message?.toLowerCase() || "";
        const esRateLimit =
          msg.includes("quota") ||
          msg.includes("429") ||
          msg.includes("resource_exhausted") ||
          msg.includes("maxretriesexceeded");
        res.write(
          `data: ${JSON.stringify({
            tipo: "error",
            mensaje: esRateLimit
              ? "Limite de consultas alcanzado. Espera unos minutos e intenta de nuevo."
              : "Error procesando la consulta.",
          })}\n\n`,
        );
      }
      if (parte.type === "finish")
        res.write(
          `data: ${JSON.stringify({ tipo: "fin", tokens: parte.totalUsage.totalTokens ?? 0 })}\n\n`,
        );
    }
    console.error = originalConsoleError;
  } catch (e: any) {
    const msg = e?.message?.toLowerCase() || "";
    const esRateLimit =
      msg.includes("quota") ||
      msg.includes("429") ||
      msg.includes("resource_exhausted") ||
      msg.includes("maxretriesexceeded");
    res.write(
      `data: ${JSON.stringify({
        tipo: "error",
        mensaje: esRateLimit
          ? "Limite de consultas alcanzado. Espera unos minutos e intenta de nuevo."
          : "Error procesando la consulta.",
      })}\n\n`,
    );
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
