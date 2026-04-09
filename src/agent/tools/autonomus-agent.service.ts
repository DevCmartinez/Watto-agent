import { generateText, streamText, ModelMessage, stepCountIs, Tool } from "ai";
import { Response } from "express";

// Interfaz mínima para respuestas de streaming (compatible con Express Response y Fakes)
export interface StreamingResponse {
  setHeader(name: string, value?: string | number | readonly string[]): void;
  write(data: string): boolean | void;
  end(): void;
  headersSent: boolean;
}

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
import * as crypto from 'crypto';

/**
 * @origin [src/agent/tools/autonomus-agent.service.ts]
 * @calledBy [src/controllers/agent.controller.ts] y [src/app.ts]
 * @description Lógica central del Agente. Maneja el descubrimiento de esquemas,
 * la creación del sistema de prompts y la interacción con modelos de IA (OpenAI/Google).
 */
let systemPrompt: string | null = null;

export let listo: boolean = false;

/**
 * Interfaz para herramientas del agente (permite IoC y testing con mocks).
 * Compatible con Record<string, Tool> del SDK de Vercel AI.
 */
export type AgentTools = Record<string, Tool>;

/**
 * Obtiene las herramientas activas según el modo configurado.
 * Soporta inyección de herramientas para testing o extensiones.
 */
function getTools(injectedTools?: AgentTools): Record<string, Tool> {
  // Si se injectaron tools, usar esas (para testing o extensiones)
  if (injectedTools && Object.keys(injectedTools).length > 0) {
    return injectedTools;
  }

  // Tools por defecto según el modo
  const tools: Record<string, Tool> = {};
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

// SEC-08: Cache dentro del proyecto con nombre obfuscado basado en hash
// No predecible desde fuera, se limpia automáticamente en cada deploy/restart
const CACHE_PATH = path.join(process.cwd(), '.cache', `.watto-${crypto.createHash('sha256').update(env.agent.mode).digest('hex').slice(0, 12)}.bin`);

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

// OPT-01: versión async para no bloquear el event loop
async function guardarCache(prompt: string): Promise<void> {
  try {
    const cache: SchemaCache = {
      systemPrompt: prompt,
      generadoEn: new Date().toISOString(),
      modo: env.agent.mode,
    };
    // Asegurar que el directorio .cache existe
    const cacheDir = path.dirname(CACHE_PATH);
    await fs.promises.mkdir(cacheDir, { recursive: true });
    await fs.promises.writeFile(CACHE_PATH, JSON.stringify(cache), 'utf-8');
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

  // SEC-SSRF: Validar configuraciones de URLs antes de usar
  validarConfiguracionUrls();

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
  await guardarCache(systemPrompt);
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
// Límite de historial para evitar DoS por acumulación de mensajes
const MAX_HISTORIAL_MENSAJES = 20;

export async function consultarAgente(
  pregunta: string,
  historial: ModelMessage[] = [],
  injectedTools?: AgentTools,
): Promise<{ texto: string; tokens: number; tiempoMs: number }> {
  verificar();
  const inicio = Date.now();
  const tools = getTools(injectedTools);
  // Limitar historial a los últimos MAX_HISTORIAL_MENSAJES para evitar DoS
  const historialLimitado = historial.slice(-MAX_HISTORIAL_MENSAJES);
  const resultado = await generateText({
    model: aiModel,
    system: systemPrompt!,
    messages: [...historialLimitado, { role: "user", content: pregunta }],
    tools,
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
  res: StreamingResponse,
  historial: ModelMessage[] = [],
  injectedTools?: AgentTools,
): Promise<void> {
  verificar();
  const tools = getTools(injectedTools);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const originalConsoleError = console.error;
  console.error = () => { };

  // PERF-05: Timeout para evitar streams colgados (2 minutos)
  const TIMEOUT_MS = 120 * 1000;
  let timeoutId = setTimeout(() => {
    console.error = originalConsoleError;
    res.write(`data: ${JSON.stringify({ tipo: 'error', mensaje: 'Tiempo de espera agotado. La consulta tardó demasiado.' })}\n\n`);
    res.end();
  }, TIMEOUT_MS);

  try {
    // Limitar historial a los últimos MAX_HISTORIAL_MENSAJES para evitar DoS
    const historialLimitado = historial.slice(-MAX_HISTORIAL_MENSAJES);
    const resultado = streamText({
      model: aiModel,
      system: systemPrompt! + "\n\nNOTA: Si los datos son muy extensos, sugiere opcionalmente la exportación a Excel/PDF para mejor visualización.",
      messages: [...historialLimitado, { role: "user", content: pregunta }],
      tools,
      stopWhen: stepCountIs(10),
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

    let textoAcumulado = '';
    let bloqueTecnicoAbierto = false;

    for await (const parte of resultado.fullStream) {
      clearTimeout(timeoutId); // Reiniciar timeout con cada evento recibido
      timeoutId = setTimeout(() => {
        console.error = originalConsoleError;
        res.write(`data: ${JSON.stringify({ tipo: 'error', mensaje: 'Tiempo de espera agotado. La consulta tardó demasiado.' })}\n\n`);
        res.end();
      }, TIMEOUT_MS);
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

          // SEC-04: Enviamos sql/formato/titulo directamente (sin URL con query string)
          // El cliente hará POST a /api/export con estos datos en el body
          res.write(`data: ${JSON.stringify({ tipo: 'export_url', sql, formato, titulo })}\n\n`);

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
    clearTimeout(timeoutId);
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
    clearTimeout(timeoutId);
    console.error = originalConsoleError;
    res.end();
  }
}

/**
 * SEC-SSRF: Valida las URLs configuradas en .env al arranque
 * Bloquea: schemes peligrosos, IPs de metadata cloud, localhost en prod
 */
function validarConfiguracionUrls(): void {
  const baseUrl = env.agent.api.baseUrl;
  const openApiUrl = env.agent.api.openApiUrl;
  const urls = [baseUrl, openApiUrl].filter(Boolean) as string[];

  const IPs_METADATA = [
    '169.254.169.254', // AWS metadata
    'metadata.google.internal', // GCP metadata
    'metadata.internal', // Azure metadata
  ];

  for (const urlStr of urls) {
    try {
      const parsed = new URL(urlStr);

      // 1. Solo schemes http/https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Protocolo '${parsed.protocol}' no permitido`);
      }

      // 2. Bloquear IPs de metadata cloud (SIEMPRE, sin importar el entorno)
      if (IPs_METADATA.includes(parsed.hostname)) {
        throw new Error(`Acceso a '${parsed.hostname}' bloqueado por seguridad (SSRF)`);
      }

      // 3. Bloquear localhost e IPs privadas en producción Y en desarrollo con flag
      const esDesarrolloInseguro = process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_URLS !== 'true';
      if (esDesarrolloInseguro || process.env.NODE_ENV === 'production') {
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          throw new Error('localhost no permitido');
        }
        // Bloq IPs privadas RFC1918: 10.x, 172.16-31.x, 192.168.x
        if (/^10\./.test(parsed.hostname) ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(parsed.hostname) ||
            /^192\.168\./.test(parsed.hostname)) {
          throw new Error('IPs privadas no permitidas');
        }
      }

      console.log(`[STARTUP] URL validada OK: ${urlStr}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'URL inválida';
      console.error(`[STARTUP] Configuración insegura bloqueada: ${urlStr} — ${msg}`);

      // Siempre fallar el startup para IPs de metadata y en producción
      // En desarrollo solo warning para localhost/IPs privadas (con ALLOW_LOCAL_URLS=true)
      const esIpMetadata = IPs_METADATA.some(ip => urlStr.includes(ip));
      if (process.env.NODE_ENV === 'production' || esIpMetadata) {
        throw new Error(`Configuración insegura en variable de entorno: ${msg}`);
      }

      console.warn('⚠️  Advertencia: Esta configuración sería bloqueada en producción');
    }
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