import * as fs from "fs";
import * as path from "path";
import { env } from "../../config/env";

export interface EsquemaEndpoint {
  metodo: string;
  ruta: string;
  descripcion: string;
  parametros: EsquemaParametro[];
  cuerpo?: string;
  respuesta: string;
}

export interface EsquemaParametro {
  nombre: string;
  ubicacion: string;
  tipo: string;
  requerido: boolean;
  descripcion: string;
}

let cacheApi: { data: EsquemaEndpoint[] | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_API_TTL_MS = 60 * 60 * 1000; // 1 hora

// Verifica si el cache de API es válido
function cacheApiValido(): boolean {
  if (!cacheApi.data || !cacheApi.timestamp) return false;
  return (Date.now() - cacheApi.timestamp) < CACHE_API_TTL_MS;
}

export async function descubrirEsquemaAPI(): Promise<EsquemaEndpoint[]> {
  if (cacheApiValido() && cacheApi.data) {
    return cacheApi.data;
  }
  console.log(`[${env.agent.name}] Está Leyendo el esquema OpenAPI...]`);
  const url = env.agent.api.openApiUrl;
  if (!url) throw new Error("AGENT_API_OPENAPI_URL no configurado en .env");

  // Tipo para respuesta JSON de OpenAPI (simplificado)
  interface OpenAPIDoc {
    paths?: Record<string, Record<string, {
      summary?: string;
      description?: string;
      parameters?: Array<{
        name: string;
        in: string;
        schema?: { type?: string };
        required?: boolean;
        description?: string;
      }>;
      responses?: Record<string, { description?: string }>;
    }>>;
  }

  let contenido: OpenAPIDoc;
  if (url.startsWith("http")) {
    const resp = await fetch(url, {
      headers: env.agent.api.authToken
        ? { Authorization: env.agent.api.authToken }
        : {},
    });
    if (!resp.ok) throw new Error(`Error descargando OpenAPI: ${resp.status}`);
    contenido = await resp.json() as OpenAPIDoc;
  } else {
    contenido = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), url), "utf-8"),
    ) as OpenAPIDoc;
  }

  const endpoints: EsquemaEndpoint[] = [];
  const paths = contenido.paths || {};
  for (const ruta of Object.keys(paths)) {
    const rutaObj = paths[ruta] || {};
    for (const metodo of Object.keys(rutaObj)) {
      if (!["get", "post", "put", "patch", "delete"].includes(metodo)) continue;
      const op = rutaObj[metodo];
      const params: EsquemaParametro[] = (op.parameters || []).map((p) => ({
        nombre: p.name,
        ubicacion: p.in,
        tipo: p.schema?.type || "string",
        requerido: p.required || false,
        descripcion: p.description || "",
      }));
      const resp200 =
        (op.responses || {})["200"] || (op.responses || {})["201"] || {};
      endpoints.push({
        metodo: metodo.toUpperCase(),
        ruta,
        descripcion:
          op.summary || op.description || `${metodo.toUpperCase()} ${ruta}`,
        parametros: params,
        respuesta: resp200.description || "",
      });
    }
  }
  cacheApi = { data: endpoints, timestamp: Date.now() };
  console.log(`[${env.agent.name}] Descubrí ${endpoints.length} endpoint(s)`);
  return endpoints;
}

export function invalidarCacheAPI(): void {
  cacheApi = { data: null, timestamp: 0 };
}
