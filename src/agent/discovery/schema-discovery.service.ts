import pool from "../../config/database";
import { env } from "../../config/env";

//Interfaces para el esquema de la base de datos
export interface EsquemaTabla {
  nombre: string;
  columnas: EsquemaColumna[];
  relacionesForaneas: RelacionForanea[];
}
export interface EsquemaColumna {
  nombre: string;
  tipo: string;
  nulo: boolean;
  clavePrimaria: boolean;
  extra: string;
}
export interface RelacionForanea {
  columna: string;
  tablaReferencia: string;
  columnaReferencia: string;
}

//Cache para evitar consultas repetidas
let cache: EsquemaTabla[] | null = null;

//Función para descubrir el esquema de la base de datos
export async function descubrirEsquemaBD(): Promise<EsquemaTabla[]> {
  if (cache) return cache;
  console.log("[Discovery] Leyendo esquema de MySQL...");
  const [tablas] = await pool.query<any>("SHOW TABLES");
  const claveTabla = Object.keys(tablas[0])[0];
  let nombres: string[] = tablas.map((t: any) => t[claveTabla]);

  // Filtrar tablas excluidas desde .env
  const excluidas = env.agent.db.excludeTables;
  if (excluidas.length > 0) {
    nombres = nombres.filter((t) => !excluidas.includes(t));
  }
  console.log(`[Discovery] Tablas incluidas: ${nombres.join(", ")}`);

  //Crear un array de esquemas
  const esquemas: EsquemaTabla[] = [];
  for (const nombre of nombres) {
    const [cols] = await pool.query<any>(`DESCRIBE ${nombre}`);
    const columnas: EsquemaColumna[] = cols.map((c: any) => ({
      nombre: c.Field,
      tipo: c.Type,
      nulo: c.Null === "YES",
      clavePrimaria: c.Key === "PRI",
      extra: c.Extra,
    }));
    const [fks] = await pool.query<any>(
      `
SELECT COLUMN_NAME AS columna,
REFERENCED_TABLE_NAME AS tablaReferencia,
REFERENCED_COLUMN_NAME AS columnaReferencia
FROMINFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERETABLE_SCHEMA = DATABASE()
AND
TABLE_NAME = ? AND
REFERENCED_TABLE_NAME IS NOT NULL`,
      [nombre],
    );
    esquemas.push({
      nombre,
      columnas,
      relacionesForaneas: fks.map((f: any) => ({
        columna: f.columna,
        tablaReferencia: f.tablaReferencia,
        columnaReferencia: f.columnaReferencia,
      })),
    });
  }
  cache = esquemas;
  console.log(`[Discovery] ${esquemas.length} tabla(s) procesada(s)`);
  return esquemas;
}
export function invalidarCache(): void {
  cache = null;
}
