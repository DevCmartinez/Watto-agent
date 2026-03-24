/**
 * @origin [src/repositories/usuario.repository.ts]
 * @calledBy [src/services/auth.service.ts] y [src/middlewares/auth.middleware.ts]
 * @description Capa de persistencia directa para la entidad 'usuarios'.
 * Maneja todas las interacciones CRUD con la base de datos MySQL mediante [database.ts].
 */
import pool from "../config/database";
import { Usuario, CrearUsuarioDto } from "../models/usuario.model";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * Recupera un usuario completo filtrando por su dirección de correo electrónico.
 * @param email Correo electrónico a buscar.
 * @returns El objeto Usuario si existe y está activo, de lo contrario null.
 */
export async function findByEmail(email: string): Promise<Usuario | null> {
  // Ejecución de consulta parametrizada para evitar SQL Injection
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM usuarios WHERE email = ? AND activo = 1 LIMIT 1",
    [email],
  );
  return rows.length > 0 ? (rows[0] as Usuario) : null;
}

/**
 * Localiza un usuario por su identificador único (ID).
 * @calledBy authMiddleware en [auth.middleware.ts]
 * @param id Identificador numérico del usuario.
 * @returns Datos del usuario o null si no se encuentra.
 */
export async function findById(id: number): Promise<Usuario | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1",
    [id],
  );
  return rows.length > 0 ? (rows[0] as Usuario) : null;
}

/**
 * Inserta un nuevo registro de usuario en la base de datos.
 * @param datos Objeto con la información necesaria (Nombre, Email, Hash del Password).
 * @returns El identificador (ID) generado por la base de datos para el nuevo registro.
 */
export async function createUsuario(datos: CrearUsuarioDto): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`,
    [datos.nombre, datos.email, datos.password, datos.rol || "usuario"],
  );
  return result.insertId;
}

/**
 * Verifica de forma rápida la existencia de un correo en la tabla de usuarios.
 * Se utiliza principalmente en flujos de registro para evitar duplicados.
 * @param email Correo a validar.
 * @returns Verdadero si el email ya existe en algún registro.
 */
export async function emailExiste(email: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
    [email],
  );
  return rows.length > 0;
}

