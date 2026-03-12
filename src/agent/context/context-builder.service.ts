import { env } from "../../config/env";
import { EsquemaTabla } from "../discovery/schema-discovery.service";
import { EsquemaEndpoint } from "../discovery/openapi-discovery.service";

export function construirSystemPrompt(
  esquemaBD?: EsquemaTabla[],
  esquemaAPI?: EsquemaEndpoint[],
): string {
  const partes: string[] = [];
  partes.push(
    `Eres ${env.agent.name}, agente IA de: ${env.agent.context}.
    REGLAS:
    1. Responde SIEMPRE en el idioma que te hablen.
    2. Se preciso y conciso. NUNCA inventes datos.
    3. Si no tienes informacion suficiente para responder, dilo claramente.
    4. No menciones nombres de tablas internas ni limitaciones tecnicas al usuario.
    5. SELECT: ejecuta directo con confirmado=true.
    6. INSERT/UPDATE/DELETE: explica en lenguaje natural (SIN mostrar SQL), pregunta "Confirmas? (si/no)", ejecuta solo si responden "si" con confirmado=true.
    7. DROP/TRUNCATE/ALTER/CREATE: bloqueados siempre.
    8. Para operaciones en tabla usuarios usa SIEMPRE gestionarUsuario, nunca ejecutarSQL:
    - accion=crear: SOLO si el usuario NO EXISTE aun.
    - accion=actualizar: si el usuario YA EXISTE y quieres cambiar password, nombre, rol o correo. Requiere el ID del usuario.
    - accion=desactivar: para deshabilitar acceso sin borrar el registro.
    Para actualizar password de usuario existente: accion=actualizar, datos={id: X, password: "nueva"}.
    9. Formatea numeros con separadores de miles: 1,234.56 no 1234.56.asigna decimales si es necesario.
    10. Campos autogenerados (numeros de cuenta, IDs, codigos): usa funciones MySQL como FLOOR(RAND()*9000000000)+1000000000.`.trim(),
  );

  if (esquemaBD && esquemaBD.length > 0) {
    // Esquema ultra comprimido — elimina palabras innecesarias
    partes.push(`\nBD MySQL — usa ejecutarSQL (solo SELECT/INSERT/UPDATE/DELETE):`);
    partes.push(`LIMIT ${env.agent.db.maxRows} en SELECT siempre.`);

    for (const tabla of esquemaBD) {
      // Formato comprimido: TABLA(col:tipo[PK],col:tipo,...)
      const cols = tabla.columnas.map(c => {
        let def = `${c.nombre}:${c.tipo.replace('varchar', 'vc').replace('int', 'i').replace('decimal', 'dec').replace('timestamp', 'ts').replace('boolean', 'bool').replace('enum', 'enum')}`;
        if (c.clavePrimaria) def += '[PK]';
        if (c.extra.includes('auto_increment')) def += '[AI]';
        return def;
      }).join(', ');

      partes.push(`${tabla.nombre}(${cols})`);

      // Relaciones en formato corto
      if (tabla.relacionesForaneas.length > 0) {
        const rels = tabla.relacionesForaneas
          .map(r => `${r.columna}->${r.tablaReferencia}.${r.columnaReferencia}`)
          .join(', ');
        partes.push(`  FK: ${rels}`);
      }
    }
  }

  if (esquemaAPI && esquemaAPI.length > 0) {
    partes.push(`\nAPI REST — usa ejecutarLlamadaAPI (solo GET):`);
    for (const ep of esquemaAPI) {
      partes.push(`[${ep.metodo}] ${ep.ruta} — ${ep.descripcion}`);
      const reqParams = ep.parametros.filter(p => p.requerido);
      if (reqParams.length > 0) {
        partes.push(`  params: ${reqParams.map(p => p.nombre).join(', ')}`);
      }
    }
  }
  // return partes.join("");
  return partes.join('\n');
}
