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
    // Credenciales invalidas -> 401, otros errores -> middleware
    if (error.message === "Credenciales invalidas") {
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
    if (error.message === "El email ya esta registrado") {
      sendError(res, error.message, 409);
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
