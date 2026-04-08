/**
 * @origin [src/controllers/auth.controller.ts]
 * @calledBy [src/routes/auth.routes.ts]
 * @description Controlador encargado de gestionar el flujo de autenticación de usuarios.
 * Interactúa con [auth.service.ts] para validar credenciales y generar tokens.
 */
import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/response.util";

/**
 * Autentica a un usuario mediante email y contraseña.
 * @route POST /api/auth/login
 * @param req Objeto de petición Express conteniendo { email, password }.
 * @param res Objeto de respuesta Express.
 * @param next Función para pasar el control al middleware de errores.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    // Llama al servicio de autenticación para validar los datos
    // La cookie HttpOnly se establece en el servicio
    const resultado = await authService.login(email, password, res);
    // Devuelve respuesta exitosa con datos del usuario (sin token)
    sendSuccess(res, resultado, "Login exitoso");
  } catch (error: unknown) {
    // Manejo específico para errores de credenciales (401)
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      sendError(res, err.message || "Credenciales inválidas", 401);
    } else {
      next(error as Error);
    }
  }
}

/**
 * Registra un nuevo usuario en el sistema.
 * @route POST /api/auth/registro
 * @param req Objeto de petición Express conteniendo { nombre, email, password }.
 * @param res Objeto de respuesta Express.
 * @param next Función para pasar el control al middleware de errores.
 */
export async function registro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, email, password } = req.body;
    // Llama al servicio para persistir el nuevo usuario
    // La cookie HttpOnly se establece en el servicio
    const resultado = await authService.registrar({ nombre, email, password }, res);
    sendSuccess(res, resultado, "Usuario registrado exitosamente", 201);
  } catch (error: unknown) {
    // Si el error tiene un código de estado definido (ej: conflicto 409)
    const err = error as { statusCode?: number; message?: string };
    if (err.statusCode) {
      sendError(res, err.message || "Error", err.statusCode);
    } else {
      next(error as Error);
    }
  }
}

/**
 * Recupera el perfil del usuario actualmente autenticado.
 * Requiere que el token haya sido validado previamente por el 'authMiddleware'.
 * @route GET /api/auth/perfil
 * @param req Objeto de petición Express (contiene req.usuario inyectado).
 * @param res Objeto de respuesta Express.
 */
export function perfil(req: Request, res: Response): void {
  // El objeto usuario fue inyectado en la petición por el middleware de autenticación
  sendSuccess(res, req.usuario, "Perfil del usuario autenticado");
}

/**
 * Cierra la sesión del usuario eliminando la cookie de autenticación.
 * @route POST /api/auth/logout
 * @param req Objeto de petición Express.
 * @param res Objeto de respuesta Express.
 */
export function logout(req: Request, res: Response): void {
  authService.logout(res);
  sendSuccess(res, null, "Sesión cerrada exitosamente");
}

