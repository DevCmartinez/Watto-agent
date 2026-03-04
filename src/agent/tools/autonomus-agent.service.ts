import { generateText, streamText, ModelMessage, stepCountIs } from "ai";
import { Response } from "express";
import { env } from "../../config/env";
import { aiModel, AI_CONFIG } from "../../ai/config/ai.config";
import { descubrirEsquemaBD } from "../../agent/discovery/schema-discovery.service";
import { descubrirEsquemaAPI } from "../../agent/discovery/openapi-discovery.service";
import { construirSystemPrompt } from "../../agent/context/context-builder.service";
import { sqlExecutorTool } from "../../agent/tools/sql-executor.tool";
import { apiExecutorTool } from "../../agent/tools/api-executor.tool";

let systemPrompt: string | null = null;
let listo = false;
function getTools(): Record<string, any> {
  const tools: Record<string, any> = {};
  const modo = env.agent.mode;

  if (modo === "db" || modo === "both") {
    tools.ejecutarSQL = sqlExecutorTool;
  }
  if (modo === "api" || modo === "both") {
    tools.ejecutarLlamadaAPI = apiExecutorTool;
  }

  return tools;
}
// Llamar una vez al arrancar el servidor
export async function inicializarAgente(): Promise<void> {
  if (listo) return;
  console.log(`
[Agente] Iniciando en modo: ${env.agent.mode.toUpperCase()}`);
  const modo = env.agent.mode;
  const esquemaBD =
    modo === "db" || modo === "both" ? await descubrirEsquemaBD() : undefined;
  const esquemaAPI =
    modo === "api" || modo === "both" ? await descubrirEsquemaAPI() : undefined;
  systemPrompt = construirSystemPrompt(esquemaBD, esquemaAPI);
  listo = true;
  console.log(`[Agente] Listo. System prompt: ${systemPrompt.length} caracteres
`);
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
      if (parte.type === "text-delta")
        res.write(`data: ${JSON.stringify({ tipo: "texto", chunk: parte.text })}
`);
      if (parte.type === "tool-call")
        res.write(`data: ${JSON.stringify({
          tipo: "tool",
          nombre: parte.toolName,
          mensaje: `Consultando: ${parte.toolName}...`,
        })}
`);
      if (parte.type === "finish")
        res.write(`data: ${JSON.stringify({ tipo: "fin", tokens: parte.totalUsage.totalTokens ?? 0 })}
`);
    }
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ tipo: "error", mensaje: e.message })}
`);
  } finally {
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
