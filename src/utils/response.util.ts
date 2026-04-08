import { Response } from "express";

// Tipo genérico para respuestas exitosas
export function sendSuccess<T = unknown>(
  res: Response,
  data: T,
  mensaje: string = "Operacion exitosa",
  status: number = 200,
): void {
  res.status(status).json({
    exitoso: true,
    mensaje,
    data,
  } as { exitoso: true; mensaje: string; data: T });
}

// Respuesta de error estandarizada
export function sendError(
  res: Response,
  mensaje: string,
  status: number = 400,
): void {
  res.status(status).json({
    exitoso: false,
    mensaje,
  } as { exitoso: false; mensaje: string });
}
