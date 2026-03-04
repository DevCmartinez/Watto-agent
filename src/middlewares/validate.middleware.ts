import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

// Ejecutar las validaciones de express-validator y responder si hay errores
export function validate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      exitoso: false,
      mensaje: "Datos de entrada invalidos",
      errores: errors.array().map((e) => ({
        campo: (e as any).path,
        mensaje: e.msg,
      })),
    });
    return;
  }
  next();
}
