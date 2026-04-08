import { Request, Response, NextFunction } from "express";

// Tipos para errores específicos
interface MySQLError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
  sqlState?: string;
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error(`[Error] ${err.message}`);

  // Extraer código HTTP (status) del error
  const codigo = (err as HttpError).status || (err as HttpError).statusCode;
  const mensaje = err.message.toLowerCase();

  // SEC-06: Solo exponer mensajes detallados en desarrollo
  const esProduccion = process.env.NODE_ENV === 'production';
  const esCodigo5xx = !codigo || codigo >= 500;

  // Error de MySQL: clave duplicada (ej: email ya existe)
  if ((err as MySQLError).code === "ER_DUP_ENTRY") {
    res.status(409).json({
      exitoso: false,
      mensaje: "El E-mail ya existe",
    });
    return;
  }

  // Rate limit de Gemini / OpenAI
  if (
    codigo === 429 ||
    mensaje.includes("quota") ||
    mensaje.includes("rate limit")
  ) {
    res.status(429).json({
      exitoso: false,
      mensaje: "Limite de peticiones de IA alcanzado. Espera unos segundos.",
    });
    return;
  }

  // Safety filter de Gemini
  if (mensaje.includes("safety") || mensaje.includes("blocked")) {
    res.status(400).json({
      exitoso: false,
      mensaje: "La consulta fue bloqueada por filtros de seguridad. Reformula la pregunta.",
    });
    return;
  }

  // SEC-06: Para errores 5xx en producción, mensaje genérico (nunca exponer internos)
  const mensajeSalida = (esProduccion && esCodigo5xx)
    ? "Error interno del servidor."
    : (err.message || "Error interno del servidor");

  res.status(codigo || 500).json({
    exitoso: false,
    mensaje: mensajeSalida,
    // Solo en desarrollo se incluye el stack trace
    error: !esProduccion ? err.message : undefined,
  });
}
