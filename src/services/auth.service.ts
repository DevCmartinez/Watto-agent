import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { hashear, verificarHash } from "../utils/hash.util";
import * as usuarioRepo from "../repositories/usuario.repository";
import { JwtPayload, UsuarioPublico, CrearUsuarioDto, } from "../models/usuario.model";

// Error personalizado para manejar errores de negocio
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Generar un token JWT con los datos del usuario
function generarToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as any,
  });
}

// ■■ Login ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
export async function login(
  email: string,
  password: string,
): Promise<{ usuario: UsuarioPublico; token: string }> {
  // 1. Buscar el usuario por email
  const usuario = await usuarioRepo.findByEmail(email);
  if (!usuario) {
    throw new AppError("Email invalido", 401);
  }
  // 2. Verificar el password contra el hash
  const passwordValido = await verificarHash(password, usuario.password);
  if (!passwordValido) {
    throw new AppError("Contraseña invalida", 401);
  }
  // 3. Generar el token JWT
  const token = generarToken({
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  });
  // 4. Retornar usuario sin password + token
  const { password: _, ...usuarioPublico } = usuario;
  return { usuario: usuarioPublico, token };
}

// ■■ Registro ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
export async function registrar(
  datos: CrearUsuarioDto,
): Promise<{ usuario: UsuarioPublico; token: string }> {
  // Verificar que el email no exista
  const existe = await usuarioRepo.emailExiste(datos.email);
  if (existe) {
    throw new AppError("El email ya esta registrado", 409);
  }
  // Hashear el password antes de guardar
  const passwordHash = await hashear(datos.password);
  // Crear el usuario
  const id = await usuarioRepo.createUsuario({
    ...datos,
    password: passwordHash,
  });
  // Obtener el usuario recien creado
  const usuario = await usuarioRepo.findById(id);
  if (!usuario) throw new Error("Error al crear el usuario");
  const token = generarToken({
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  });
  const { password: _, ...usuarioPublico } = usuario;
  return { usuario: usuarioPublico, token };
}
