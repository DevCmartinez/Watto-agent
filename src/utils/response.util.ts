import { Response } from "express";
// Respuesta exitosa estandarizada
export function sendSuccess(
  res: Response,
  data: any,
  mensaje: string = "Operacion exitosa",
  status: number = 200,
): void {
  res.status(status).json({
    exitoso: true,
    mensaje,
    data,
  });
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
  });
}
