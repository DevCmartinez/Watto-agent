import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/response.util";

// POST /api/auth/login
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body;
    const resultado = await authService.login(email, password);
    sendSuccess(res, resultado, "Login exitoso");
  } catch (error: any) {
    // Si es un error de autenticacion (401), enviamos el mensaje especifico
    if (error.statusCode === 401) {
      sendError(res, error.message, 401);
    } else {
      next(error);
    }
  }
}
// POST /api/auth/registro
export async function registro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { nombre, email, password } = req.body;
    const resultado = await authService.registrar({ nombre, email, password });
    sendSuccess(res, resultado, "Usuario registrado exitosamente", 201);
  } catch (error: any) {
    // Si es un error de negocio (con statusCode definido), usamos ese codigo
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
    } else {
      next(error);
    }
  }
}

// GET /api/auth/perfil (requiere token)
export function perfil(req: Request, res: Response): void {
  // req.usuario viene del authMiddleware
  sendSuccess(res, req.usuario, "Perfil del usuario autenticado");
}
