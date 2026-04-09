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
interface SchemaCache {
  data: EsquemaTabla[] | null;
  timestamp: number;
}
let cache: SchemaCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Verifica si el cache es válido (no expirado y no corrupto)
function cacheValido(): boolean {
  if (!cache.data || !cache.timestamp) return false;
  return (Date.now() - cache.timestamp) < CACHE_TTL_MS;
}

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

// Procesar una tabla: obtener columnas y foreign keys en paralelo
async function procesarTabla(nombre: string): Promise<EsquemaTabla> {
  const [cols, fks] = await Promise.all([
    pool.query<DescribeRow[]>(`DESCRIBE \`${nombre}\``),
    pool.query<ForeignKeyRow[]>(
      `SELECT COLUMN_NAME AS columna,
       REFERENCED_TABLE_NAME AS tablaReferencia,
       REFERENCED_COLUMN_NAME AS columnaReferencia
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [nombre]
    ),
  ]);

  return {
    nombre,
    columnas: cols[0].map((c) => ({
      nombre: c.Field,
      tipo: c.Type,
      nulo: c.Null === "YES",
      clavePrimaria: c.Key === "PRI",
      extra: c.Extra,
    })),
    relacionesForaneas: fks[0].map((f) => ({
      columna: f.columna,
      tablaReferencia: f.tablaReferencia,
      columnaReferencia: f.columnaReferencia,
    })),
  };
}

// Función para descubrir el esquema de la base de datos
export async function descubrirEsquemaBD(): Promise<EsquemaTabla[]> {
  if (cacheValido() && cache.data) {
    return cache.data;
  }

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

  // Procesar todas las tablas en paralelo (optimización de rendimiento)
  const esquemas = await Promise.all(nombres.map(procesarTabla));

  cache = { data: esquemas, timestamp: Date.now() };
  console.log(`[${env.agent.name}] ${esquemas.length} tabla(s) procesada(s)`);
  return esquemas;
}

export function invalidarCache(): void {
  cache = { data: null, timestamp: 0 };
}