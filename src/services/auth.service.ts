/**
 * @origin [src/services/auth.service.ts]
 * @calledBy [src/controllers/auth.controller.ts]
 * @description Servicio de lógica de negocio para la gestión de identidades.
 * Centraliza la validación de credenciales, hashing de contraseñas y emisión de JWT.
 */
import jwt from "jsonwebtoken";
import { Response } from "express"; // SEC-01: Tipo de respuesta Express para cookies
import { env } from "../config/env";
import { hashear, verificarHash } from "../utils/hash.util";
import * as usuarioRepo from "../repositories/usuario.repository";
import { JwtPayload, UsuarioPublico, CrearUsuarioDto } from "../models/usuario.model";

/**
 * Clase de error personalizada para el dominio de aplicación.
 * Permite propagar códigos de estado HTTP junto con el mensaje de error.
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Genera un token JWT firmado para la sesión del usuario.
 * @param payload Datos mínimos del usuario para incluir en el token.
 * @returns String conteniendo el JWT.
 */
function generarToken(payload: JwtPayload): string {
  // Using any for expiresIn due to jsonwebtoken type quirks
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as any,
  });
}

/**
 * Configura una cookie segura para el token JWT usando cookie-parser.
 * SEC-01: httpOnly previene acceso via JavaScript (XSS).
 * SEC-01: secure solo en HTTPS (producción).
 * SEC-01: SameSite=Lax permite navegación normal, bloquea CSRF en AJAX.
 */
function setAuthCookie(res: Response, token: string): void {
  const esProduccion = process.env.NODE_ENV === 'production';
  // Parsear expiresIn correctamente: "9h" → 9 horas en ms, "24h" → 24 horas en ms
  const maxAgeMs = parseExpiresIn(env.jwt.expiresIn);

  res.cookie('token', token, {
    httpOnly: true,
    secure: esProduccion, // Solo enviar via HTTPS en producción
    sameSite: 'lax' as const, // 'lax' permite navegación normal, bloquea CSRF en AJAX
    maxAge: maxAgeMs,
    path: '/',
  });
}

/**
 * Parsea JWT_EXPIRES_IN correctamente.
 * Soporta formato "Nh" (ej: "9h", "24h"). Retorna milliseconds.
 * Valor mínimo: 1 hora. Máximo: 12 horas.
 */
function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)(h)$/i);
  if (!match) {
    // Si no matchea el formato esperado, usar 9h por defecto
    console.warn(`[Auth] JWT_EXPIRES_IN="${value}" no reconocido, usando 9h por defecto`);
    return 9 * 60 * 60 * 1000;
  }
  const horas = parseInt(match[1], 10);
  // Limitar entre 1 y 12 horas para seguridad
  const horasLimitado = Math.min(Math.max(horas, 1), 12);
  return horasLimitado * 60 * 60 * 1000;
}

/**
 * Elimina la cookie de autenticación (logout).
 */
function clearAuthCookie(res: Response): void {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });
}

/**
 * Procesa el inicio de sesión validando email y contraseña.
 * @calledBy login en [auth.controller.ts]
 * @param email Correo electrónico del usuario.
 * @param password Contraseña en texto plano.
 * @returns Objeto con los datos públicos del usuario y su token de acceso.
 * @throws AppError (401) si las credenciales son incorrectas.
 */
export async function login(
  email: string,
  password: string,
  res?: Response, // Opcional: si se provee, se establece cookie HttpOnly
): Promise<{ usuario: UsuarioPublico }> {
  // 1. Localizar registro en la base de datos (vía repositorio)
  const usuario = await usuarioRepo.findByEmail(email);
  if (!usuario) {
    throw new AppError("Las credenciales proporcionadas no son válidas.", 401);
  }

  // 2. Comparación segura del hash de la contraseña (bcrypt/argon2)
  const passwordValido = await verificarHash(password, usuario.password);
  if (!passwordValido) {
    throw new AppError("Las credenciales proporcionadas no son válidas.", 401);
  }

  // 3. Emisión de credencial de acceso (JWT)
  const token = generarToken({
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  });

  // 4. Si hay respuesta (request), establecer cookie HttpOnly
  if (res) {
    setAuthCookie(res, token);
  }

  // 5. Sanitización de datos (Eliminamos el password antes de devolver al cliente)
  const { password: _, ...usuarioPublico } = usuario;
  return { usuario: usuarioPublico };
}

/**
 * Registra un nuevo perfil de usuario en el sistema.
 * @calledBy registro en [auth.controller.ts]
 * @param datos Objeto con { nombre, email, password }.
 * @returns Objeto con los datos del nuevo usuario y su token inicial.
 * @throws AppError (409) si el correo ya está en uso.
 */
export async function registrar(
  datos: CrearUsuarioDto,
  res?: Response, // Opcional: si se provee, se establece cookie HttpOnly
): Promise<{ usuario: UsuarioPublico }> {
  // Verificación de unicidad de identidad
  const existe = await usuarioRepo.emailExiste(datos.email);
  if (existe) {
    throw new AppError("Esta dirección de correo ya se encuentra registrada.", 409);
  }

  // Protección de credencial: Hashing asíncrono
  const passwordHash = await hashear(datos.password);

  // Persistencia en base de datos
  const id = await usuarioRepo.createUsuario({
    ...datos,
    password: passwordHash,
  });

  // Recuperación del registro completo para confirmación
  const usuario = await usuarioRepo.findById(id);
  if (!usuario) throw new Error("Fallo crítico en la creación del registro de usuario.");

  const token = generarToken({
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  });

  // Si hay respuesta (request), establecer cookie HttpOnly
  if (res) {
    setAuthCookie(res, token);
  }

  const { password: _, ...usuarioPublico } = usuario;
  return { usuario: usuarioPublico };
}

/**
 * Cierra la sesión del usuario eliminando la cookie de autenticación.
 * @param res Response de Express para manipular cookies
 */
export function logout(res: Response): void {
  clearAuthCookie(res);
}

