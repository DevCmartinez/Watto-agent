/**
 * @origin [src/middlewares/auth.middleware.ts]
 * @description Interceptores de seguridad para proteger rutas privadas. 
 * Valida la autenticidad de los tokens JWT y gestiona permisos por rol.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../models/usuario.model";

/**
 * Extensión global del namespace de Express.
 * Permite que TypeScript reconozca la propiedad 'usuario' inyectada en el objeto Request.
 */
declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

/**
 * Middleware de protección de ruta por Token.
 * @calledBy Rutas que requieren sesión activa (ej: /api/agent/*, /api/auth/perfil)
 * @param req Petición Express (se espera header Authorization: Bearer <TOKEN>)
 * @param res Respuesta Express
 * @param next Siguiente middleware en la cadena
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Extraer el header Authorization
  const authHeader = req.headers.authorization;

  // 2. Validar el formato del Bearer token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ 
      exitoso: false, 
      mensaje: "Acceso no autorizado. Se requiere un token de seguridad válido." 
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    // 3. Verificar la firma del token con la clave secreta del servidor
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    
    // 4. Inyectar datos del usuario en la petición para uso posterior en controladores
    req.usuario = payload;
    next();
  } catch (error) {
    // Error si el token fue manipulado, expiró o es inválido
    res.status(401).json({ 
      exitoso: false, 
      mensaje: "La sesión ha expirado o el token es inválido. Por favor, inicie sesión nuevamente." 
    });
  }
}

/**
 * Middleware restrictivo para operaciones exclusivas de Administrador.
 * Debe usarse SIEMPRE después de 'authMiddleware'.
 * @param req Petición que ya contiene datos del usuario.
 * @param res Respuesta Express.
 * @param next Siguiente middleware.
 */
export function soloAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.usuario?.rol !== "admin") {
    res.status(403).json({ 
      exitoso: false, 
      mensaje: "Acceso denegado. Se requieren privilegios de administrador para esta operación." 
    });
    return;
  }
  next();
}

