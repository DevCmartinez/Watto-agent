import pool from "../config/database";
import { Usuario, CrearUsuarioDto } from "../models/usuario.model";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// Buscar un usuario por su email (para login)
export async function findByEmail(email: string): Promise<Usuario | null> {
  const [rows] = await pool.query<any>(
    "SELECT * FROM usuarios WHERE email = ? AND activo = 1 LIMIT 1",
    [email],
  );
  return rows.length > 0 ? (rows[0] as Usuario) : null;
}

// Buscar un usuario por su ID (para el middleware de auth)
export async function findById(id: number): Promise<Usuario | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1",
    [id],
  );
  return rows.length > 0 ? (rows[0] as Usuario) : null;
}
// Crear un nuevo usuario
export async function createUsuario(datos: CrearUsuarioDto): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO usuarios (nombre, email, password, rol)
VALUES (?, ?, ?, ?)`,
    [datos.nombre, datos.email, datos.password, datos.rol || "usuario"],
  );
  return result.insertId;
}
// Buscar usuario por email
export async function emailExiste(email: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
    [email],
  );
  return rows.length > 0;
}
