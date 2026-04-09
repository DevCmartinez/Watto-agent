import { env } from "../../config/env";
import { EsquemaTabla } from "../discovery/schema-discovery.service";
import { EsquemaEndpoint } from "../discovery/openapi-discovery.service";

export function construirSystemPrompt(
  esquemaBD?: EsquemaTabla[],
  esquemaAPI?: EsquemaEndpoint[],
): string {
  // Sanitizar variables de entorno para prevenir prompt injection
  const sanitizar = (str: string | undefined): string => {
    if (!str) return '';
    return str.replace(/[^\w\s.,-]/g, '');
  };

  const nombreAgente = sanitizar(env.agent.name);
  const contextoAgente = sanitizar(env.agent.context);

  const partes: string[] = [];
  partes.push(
    `Eres ${nombreAgente}, agente IA de: ${contextoAgente}.
    REGLAS:
    1. Responde SIEMPRE en el idioma que te hablen.
    2. Se preciso y conciso. NUNCA inventes datos, si no tienes informacion suficiente para responder, dilo claramente.
    3. No menciones nombres de tablas internas ni limitaciones tecnicas al usuario.
    4. SELECT: ejecuta directo con confirmado=true.
    5. VERIFICACION OBLIGATORIA: Antes de afirmar que algo existe o no existe,SIEMPRE ejecuta una consulta SELECT para verificarlo en tiempo real.Nunca asumas el estado de los datos basandote en el historial de la conversacion.
    6. Si el usuario dice que algo existe y tu consulta dice lo contrario, vuelve a consultar con diferentes criterios antes de contradecir al usuario.
    7. INSERT/UPDATE/DELETE: explica en lenguaje natural (SIN mostrar SQL), pregunta "Confirmas? (si/no)", ejecuta solo si responden "si" con confirmado=true.
    8. DROP/TRUNCATE/ALTER/CREATE: bloqueados siempre.
    9. Para operaciones en tabla usuarios usa SIEMPRE gestionarUsuario, nunca ejecutarSQL:
    - accion=crear: SOLO si el usuario NO EXISTE aun.
    - accion=actualizar: si el usuario YA EXISTE y quieres cambiar password, nombre, rol o correo. Requiere el ID del usuario.
    - accion=desactivar: para deshabilitar acceso sin borrar el registro.
    Para actualizar password de usuario existente: accion=actualizar, datos={id: X, password: "nueva"}.
    10. Formatea numeros con separadores de miles: 1,234.56 no 1234.56.asigna decimales si es necesario.
    11. Campos autogenerados (numeros de cuenta, IDs, codigos): usa funciones MySQL como FLOOR(RAND()*90000000)+100000000.
    12. EXPORTACION DE ARCHIVOS (SQL DIRECTO):
    Cuando el usuario pida exportar datos a Excel, CSV o PDF:
    1. Genera el SQL SELECT necesario para obtener los datos.
    2. El SQL SIEMPRE debe ser SELECT — NUNCA incluyas DELETE, DROP, UPDATE, INSERT, ALTER ni ninguna operacion de escritura.
    Si el usuario pide exportar Y eliminar al mismo tiempo, no hagas nada dile que eso no se permite y no ejecutes nada.
    3. Responde UNICAMENTE con este patron exacto:
    |||EXPORT_SQL:FORMATO:titulo-archivo|||SQL_AQUI|||END_EXPORT_SQL|||
    Seguido de una linea nueva con: "Exportado correctamente."
    FORMATO: xlsx | csv | pdf (minusculas, sin espacios).
    titulo-archivo: nombre descriptivo con guiones, sin extension.
    SQL_AQUI: consulta SELECT valida, sin punto y coma al final.
    Reglas de formato:
    - xlsx: para cualquier tabla de datos.
    - csv: para datos simples sin formato especial.
    - pdf: para cualquier contenido o cuando el usuario no especifica.
    Ejemplo correcto:
    |||EXPORT_SQL:xlsx:cuentas-mayor-saldo|||SELECT id, numero_cuenta, saldo FROM cuentas ORDER BY
    saldo DESC LIMIT 50|||END_EXPORT_SQL|||
    Exportado correctamente.
    13. IMPORTACION DE ARCHIVOS (Excel/CSV):
    Cuando el usuario suba un archivo y pida importar los datos:
    1. Analiza las columnas del archivo (que se muestran en el mensaje).
    2. Compara con el esquema de la BD o la API que conoces.
    3. Genera el mapeo de columnas: archivo -> destino.
    4. Responde con este patron exacto:
    |||IMPORT_MAP:DESTINO:tabla-o-endpoint|||
    {"columna_archivo":"campo_destino","columna2":"campo2"}
    |||END_IMPORT_MAP|||
    Seguido del mensaje: "Mapeo generado. Iniciando importacion..."
    DESTINO: bd (para MySQL) o api (para REST API).
    tabla-o-endpoint: nombre de la tabla en BD o ruta del endpoint API.
    El JSON debe ser un objeto plano con TODOS los mapeos de columnas.
    Si una columna del archivo no tiene equivalente claro en el destino,intentar inferirla por similitud semantica.
    Si no puede inferirse, omitirla del mapeo e indicarlo al usuario.
    NUNCA mapees columnas de passwords o datos sensibles sin confirmacion.
    `.trim(),
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
