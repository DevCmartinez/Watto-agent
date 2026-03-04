import { tool } from "ai";
import { z } from "zod";
import { env } from "../../config/env";

export const apiExecutorTool = (tool as any)({
  description:
    "Ejecuta una llamada GET a la API REST externa y retorna los datos. " +
    "Usar la ruta y parametros correctos basandose en los endpoints del contexto.",
  parameters: z.object({
    ruta: z
      .string()
      .describe(
        "Ruta relativa del endpoint. Ejemplo: /customers o /invoices?status=open",
      ),
    parametrosQuery: z
      .record(z.string(), z.string())
      .optional()
      .describe("Parametros adicionales de query como objeto clave-valor."),
    descripcion: z.string().describe("Que informacion se esta pidiendo."),
  }),
  execute: async ({
    ruta,
    parametrosQuery,
    descripcion,
  }: {
    ruta: string;
    parametrosQuery?: Record<string, string>;
    descripcion: string;
  }) => {
    console.log(`[API] ${descripcion}`);
    const baseUrl = env.agent.api.baseUrl;
    if (!baseUrl)
      return { exito: false, error: "AGENT_API_BASE_URL no configurado." };
    let url = `${baseUrl.replace(/\/$/, "")}/${ruta.replace(/^\//, "")}`;
    if (parametrosQuery && Object.keys(parametrosQuery).length > 0) {
      url += "?" + new URLSearchParams(parametrosQuery).toString();
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (env.agent.api.authToken) {
      const tipos: Record<string, string> = {
        bearer: `Bearer ${env.agent.api.authToken}`,
        basic: `Basic ${env.agent.api.authToken}`,
        apikey: env.agent.api.authToken,
      };
      const headerNombre =
        env.agent.api.authType === "apikey" ? "X-API-Key" : "Authorization";
      headers[headerNombre] =
        tipos[env.agent.api.authType] || env.agent.api.authToken;
    }
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);
      const resp = await fetch(url, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        return {
          exito: false,
          error: `HTTP ${resp.status}: ${resp.statusText}`,
          url,
        };
      }
      const datos: any = await resp.json();
      const total = Array.isArray(datos) ? datos.length : datos.total || "N/A";
      console.log(`[API] OK — items: ${total}`);
      return { exito: true, datos, total_items: total };
    } catch (e: any) {
      return {
        exito: false,
        error: e.name === "AbortError" ? "Timeout (15s)" : e.message,
      };
    }
  },
});
