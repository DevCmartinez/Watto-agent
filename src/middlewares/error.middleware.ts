import { Request, Response, NextFunction } from "express";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error(`[Error] ${err.message}`);
  const codigo = (err as any).status || (err as any).statusCode;
  const mensaje = err.message.toLowerCase();
  // Rate limit de Gemini
  if (
    codigo === 429 ||
    mensaje.includes("quota") ||
    mensaje.includes("rate limit")
  ) {
    res
      .status(429)
      .json({
        exitoso: false,
        mensaje: "Limite de peticiones de IA alcanzado.Espera unos segundos.",
      });
    return;
  }
  // Safety filter de Gemini
  if (mensaje.includes("safety") || mensaje.includes("blocked")) {
    res
      .status(400)
      .json({
        exitoso: false,
        mensaje:
          "La consulta fue bloqueada por filtros de seguridad. Reformula la pregunta.",
      });
    return;
  }
  res.status(codigo || 500).json({
    exitoso: false,
    mensaje: err.message || "Error interno del servidor",
  });
}
