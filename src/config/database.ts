import mysql from "mysql2/promise";
import { env } from "./env";
// Pool de conexiones MySQL
// Un pool mantiene varias conexiones abiertas y las reutiliza,
// evitando el costo de abrir/cerrar una conexion en cada query.
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  waitForConnections: true,
  connectionLimit: 10,// Maximas conexiones simultaneas
  queueLimit: 0, // Sin limite de cola de espera
  charset: "utf8mb4", // Soporte completo de Unicode
});
// Funcion para verificar la conexion al arrancar el servidor
export async function connectDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log(`[DB] Conectado a MySQL: ${env.db.host}/${env.db.name}`);
}
export default pool;
