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

let cacheApi: EsquemaEndpoint[] | null = null;

export async function descubrirEsquemaAPI(): Promise<EsquemaEndpoint[]> {
  if (cacheApi) return cacheApi;
  console.log(`[${env.agent.name}] Está Leyendo el esquema OpenAPI...]`);
  const url = env.agent.api.openApiUrl;
  if (!url) throw new Error("AGENT_API_OPENAPI_URL no configurado en .env");
  let contenido: any;
  if (url.startsWith("http")) {
    const resp = await fetch(url, {
      headers: env.agent.api.authToken
        ? { Authorization: env.agent.api.authToken }
        : {},
    });
    if (!resp.ok) throw new Error(`Error descargando OpenAPI: ${resp.status}`);
    contenido = await resp.json();
  } else {
    contenido = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), url), "utf-8"),
    );
  }
  const endpoints: EsquemaEndpoint[] = [];
  for (const ruta of Object.keys(contenido.paths || {})) {
    for (const metodo of Object.keys(contenido.paths[ruta])) {
      if (!["get", "post", "put", "patch", "delete"].includes(metodo)) continue;
      const op = contenido.paths[ruta][metodo];
      const params: EsquemaParametro[] = (op.parameters || []).map(
        (p: any) => ({
          nombre: p.name,
          ubicacion: p.in,
          tipo: p.schema?.type || "string",
          requerido: p.required || false,
          descripcion: p.description || "",
        }),
      );
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
  cacheApi = endpoints;
  console.log(`[${env.agent.name}] Descubrí ${endpoints.length} endpoint(s)`);
  return endpoints;
}

export function invalidarCacheAPI(): void {
  cacheApi = null;
}
