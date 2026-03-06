import { env } from "../../config/env";
import { EsquemaTabla } from "../discovery/schema-discovery.service";
import { EsquemaEndpoint } from "../discovery/openapi-discovery.service";

export function construirSystemPrompt(
  esquemaBD?: EsquemaTabla[],
  esquemaAPI?: EsquemaEndpoint[],
): string {
  const partes: string[] = [];
  partes.push(
    ` 
    REGLAS CRITICAS:
    1. Responde y explica SIEMPRE en el idioma que te hablen.
    2. Se preciso y conciso. NUNCA inventes datos. Si no encuentras informacion, dilo claramente.
    3. Si no tienes informacion suficiente para responder, dilo claramente.
    4. Cuando retornes listas, presentralas de forma organizada.
    5. Formatea los numeros del saldo con separadores de miles: escribe 1,234 no 1234, asigna decimales si es necesario y el codigo de moneda SIEMPRE.
    6. Indica siempre cuantos registros encontraste.
    7. Si te preguntan algo fuera de tu contexto, explica amablemente que solo puedes ayudar con informacion de la aplicacion.
    8. Para campos autogenerados como numeros de cuenta, IDs unicos, codigos, etc: usa funciones de MySQL directamente en el SQL como: FLOOR(RAND() * 9000000000) + 1000000000 para numeros de 10 digitos, UUID() para identificadores unicos, etc. No le pidas ese dato al usuario.

    Reglas SQL:
    -SELECT: puedes ejecutarlo directamente con confirmado = true.
    -INSERT, UPDATE, DELETE:
      1. Explica exactamente que vas hacer (SIN mostrar el SQL)
      2. Pregunta: "Confirmas esta operacion? (si/no)" 
      3. Si la respuesta es "si", ejecuta la operacion con confirmado = true.
      4. Si la respuesta es "no", no ejecutes la operacion.
    -DROP, TRUNCATE, ALTER, CREATE: NUNCA ejecutes estas operaciones, estan bloqueadas permanentemente. nunca lo intentes.
    -LIMIT ${env.agent.db.maxRows} siempre en SELECT.
`.trim(),
  );

  if (esquemaBD && esquemaBD.length > 0) {
    partes.push(`BASE DE DATOS MYSQL DISPONIBLE 
    Usa la herramienta ejecutarSQL para consultar datos.
    Genera el SQL correcto basandote en este esquema exacto:
`);
    for (const tabla of esquemaBD) {
      partes.push(`TABLA: ${tabla.nombre}`);
      for (const col of tabla.columnas) {
        const pk = col.clavePrimaria ? " [PK]" : "";
        const ai = col.extra.includes("auto_increment") ? " [AUTO]" : "";
        partes.push(`
- ${col.nombre}: ${col.tipo}${pk}${ai}`);
      }
      if (tabla.relacionesForaneas.length > 0) {
        partes.push("Relaciones (JOINs):");
        for (const rel of tabla.relacionesForaneas) {
          partes.push(`
${tabla.nombre}.${rel.columna} ->
${rel.tablaReferencia}.${rel.columnaReferencia}`);
        }
      }
    }
    partes.push(`
Reglas SQL:
- Usa siempre LIMIT ${env.agent.db.maxRows} a menos que el usuario pida menos.
- Nunca uses SELECT * — especifica siempre las columnas.
- Usa alias descriptivos: SELECT u.nombre AS usuario_nombre.
`);
  }
  if (esquemaAPI && esquemaAPI.length > 0) {
    partes.push(`
API REST DISPONIBLE
Usa la herramienta ejecutarLlamadaAPI para obtener datos.
Endpoints disponibles:
`);
    for (const ep of esquemaAPI) {
      partes.push(`[${ep.metodo}] ${ep.ruta} — ${ep.descripcion}`);
      for (const p of ep.parametros) {
        const req = p.requerido ? "(requerido)" : "(opcional)";
        partes.push(`
- ${p.nombre} [${p.ubicacion}] ${req}: ${p.descripcion}`);
      }
    }
    partes.push("Regla API: Solo usa los endpoints listados. Solo metodo GET.");
  }
  return partes.join("");
}
