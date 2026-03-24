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
    const resultado = await authService.login(email, password);
    // Devuelve respuesta exitosa con el token y datos del usuario
    sendSuccess(res, resultado, "Login exitoso");
  } catch (error: any) {
    // Manejo específico para errores de credenciales (401)
    if (error.statusCode === 401) {
      sendError(res, error.message, 401);
    } else {
      next(error);
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
    const resultado = await authService.registrar({ nombre, email, password });
    sendSuccess(res, resultado, "Usuario registrado exitosamente", 201);
  } catch (error: any) {
    // Si el error tiene un código de estado definido (ej: conflicto 409)
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
    } else {
      next(error);
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

