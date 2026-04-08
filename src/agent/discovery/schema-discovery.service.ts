import pool from "../../config/database";
import { env } from "../../config/env";
import { RowDataPacket } from "mysql2";

// Interfaces para el esquema de la base de datos
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

// Cache para evitar consultas repetidas
let cache: EsquemaTabla[] | null = null;

// Tipos para resultados de MySQL
interface ShowTableRow {
  [key: string]: string; // CLAVE: nombre de la tabla (puede ser 'Tables_in_db' o similar)
}
interface DescribeRow extends RowDataPacket {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Extra: string;
}
interface ForeignKeyRow extends RowDataPacket {
  columna: string;
  tablaReferencia: string;
  columnaReferencia: string;
}

// Función para descubrir el esquema de la base de datos
export async function descubrirEsquemaBD(): Promise<EsquemaTabla[]> {
  if (cache) return cache;
  console.log(`[${env.agent.name}] Estoy leyendo el esquema de MySQL...`);

  // Obtener lista de tablas
  const [tablas] = await pool.query<RowDataPacket[]>("SHOW TABLES");
  const claveTabla = Object.keys(tablas[0] || {})[0];
  let nombres: string[] = tablas.map((t: ShowTableRow) => t[claveTabla] || "");

  // Filtrar tablas excluidas desde .env
  const excluidas = env.agent.db.excludeTables;
  if (excluidas.length > 0) {
    nombres = nombres.filter((t) => !excluidas.includes(t));
  }
  console.log(`[${env.agent.name}] Encontre las tablas => [${nombres.join(", ")}]`);

  // Crear un array de esquemas
  const esquemas: EsquemaTabla[] = [];
  for (const nombre of nombres) {
    // Obtener columnas con DESCRIBE
    const [cols] = await pool.query<DescribeRow[]>(`DESCRIBE ${nombre}`);
    const columnas: EsquemaColumna[] = cols.map((c) => ({
      nombre: c.Field,
      tipo: c.Type,
      nulo: c.Null === "YES",
      clavePrimaria: c.Key === "PRI",
      extra: c.Extra,
    }));

    // Obtener relaciones foráneas
    const [fks] = await pool.query<ForeignKeyRow[]>(
      `
SELECT COLUMN_NAME AS columna,
REFERENCED_TABLE_NAME AS tablaReferencia,
REFERENCED_COLUMN_NAME AS columnaReferencia
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND
TABLE_NAME = ? AND
REFERENCED_TABLE_NAME IS NOT NULL`,
      [nombre],
    );

    esquemas.push({
      nombre,
      columnas,
      relacionesForaneas: fks.map((f) => ({
        columna: f.columna,
        tablaReferencia: f.tablaReferencia,
        columnaReferencia: f.columnaReferencia,
      })),
    });
  }
  cache = esquemas;
  console.log(`[${env.agent.name}] ${esquemas.length} tabla(s) procesada(s)`);
  return esquemas;
}

export function invalidarCache(): void {
  cache = null;
}
