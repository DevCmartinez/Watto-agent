import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../models/usuario.model";

// Extender el tipo Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {

  // Leer el token del header Authorization: Bearer TOKEN
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ exitoso: false, mensaje: "Token de autenticacion requerido" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    req.usuario = payload;
    next();
  } catch {
    res
      .status(401)
      .json({ exitoso: false, mensaje: "Token invalido o expirado" });
  }
}
// Middleware para verificar que el usuario sea admin
export function soloAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.usuario?.rol !== "admin") {
    res
      .status(403)
      .json({ exitoso: false, mensaje: "Acceso denegado" });
    return;
  }
  next();
}
