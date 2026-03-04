// Roles permitidos en el sistema
export type RolUsuario = "admin" | "usuario";
// Estructura de un usuario en la base de datos
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: Date;
  // Siempre hasheado, nunca texto plano
  actualizado_en: Date;
}
// Lo que se devuelve al cliente (sin el password)
export type UsuarioPublico = Omit<Usuario, "password">;
// Payload que se guarda dentro del JWT
export interface JwtPayload {
  id: number;
  email: string;
  rol: RolUsuario;
}
// Datos para crear un nuevo usuario
export interface CrearUsuarioDto {
  nombre: string;
  email: string;
  password: string;
  rol?: RolUsuario;
}
