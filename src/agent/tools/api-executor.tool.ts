/**
 * @origin [src/agent/tools/api-executor.tool.ts]
 * @calledBy El Agente IA en [autonomus-agent.service.ts]
 * @description Herramienta de conectividad externa. Permite al agente consumir microservicios 
 * o APIs REST de terceros configuradas en las variables de entorno. 
 * Soporta múltiples esquemas de autenticación (Bearer, Basic, APIKey).
 */
import { tool } from "ai";
import { z } from "zod";
import { env } from "../../config/env";

/**
 * Definición de la Tool para consumo de APIs externas.
 */
export const apiExecutorTool = tool({
  description:
    "Ejecuta una llamada GET a la API REST externa y retorna los datos. " +
    "Usar la ruta y parametros correctos basandose en los endpoints del contexto.",
  
  inputSchema: z.object({
    ruta: z
      .string()
      .describe(
        "Ruta relativa del endpoint (ej: /v1/customers). No incluir el dominio base.",
      ),
    parametrosQuery: z
      .record(z.string(), z.string())
      .optional()
      .describe("Parámetros de filtrado/búsqueda (ej: { limit: '10' })."),
    descripcion: z.string().describe("Propósito de la llamada para el log del sistema."),
  }),

  /**
   * Lógica de ejecución: Construcción de URL, Inyección de Auth y Fetch con Timeout.
   */
  execute: async ({ ruta, parametrosQuery, descripcion }) => {
    console.log(`[Agente -> API Ext] Solicitando: ${descripcion}`);
    
    // 1. Obtención de configuración base
    const baseUrl = env.agent.api.baseUrl;
    if (!baseUrl) {
      return { exito: false, error: "La variable AGENT_API_BASE_URL no está configurada en el servidor." };
    }

    // 2. Construcción robusta de la URL final
    let url = `${baseUrl.replace(/\/$/, "")}/${ruta.replace(/^\//, "")}`;
    if (parametrosQuery && Object.keys(parametrosQuery).length > 0) {
      url += "?" + new URLSearchParams(parametrosQuery).toString();
    }

    // 3. Configuración dinámica de Headers de Autenticación
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (env.agent.api.authToken) {
      // Mapeo automático de esquemas de autorización
      const tipos: Record<string, string> = {
        bearer: `Bearer ${env.agent.api.authToken}`,
        basic: `Basic ${env.agent.api.authToken}`,
        apikey: env.agent.api.authToken,
      };

      const headerNombre = env.agent.api.authType === "apikey" ? "X-API-Key" : "Authorization";
      headers[headerNombre] = tipos[env.agent.api.authType] || env.agent.api.authToken;
    }

    try {
      // 4. Mecanismo de AbortController para evitar cuelgues del hilo principal
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000); // 15 segundos máximo por petición

      const resp = await fetch(url, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });

      clearTimeout(timeout);

      // 5. Validación de respuesta HTTP
      if (!resp.ok) {
        return {
          exito: false,
          error: `Error de API Externa (HTTP ${resp.status}): ${resp.statusText}`,
          url,
        };
      }

      // 6. Retorno de datos crudos procesados por el Agente
      const datos = await resp.json(); // tipo inferido como unknown
      const total = Array.isArray(datos) ? datos.length : ((datos as { total?: number })?.total ?? "N/A");

      console.log(`[API Ext -> Agente] Éxito. Items recuperados: ${total}`);
      return { exito: true, datos, total_items: total };

    } catch (e: unknown) {
      // Manejo de timeouts y fallos de red
      const error = e instanceof Error ? e : new Error(String(e));
      return {
        exito: false,
        error: error.name === "AbortError" ? "Tiempo de espera agotado (15s)" : `Fallo de conexión: ${error.message}`,
      };
    }
  },
});

