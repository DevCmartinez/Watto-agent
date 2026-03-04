import { Request, Response, NextFunction } from "express";
import { body, validationResult, ValidationChain } from "express-validator";

// Ejecutar las validaciones de express-validator y responder si hay errores
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Ejecutar todas las reglas de validación
    for (const validation of validations) {
      await validation.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({
        exitoso: false,
        mensaje: "Datos de entrada inválidos",
        errores: errors.array().map((e) => ({
          campo: (e as any).path,
          mensaje: e.msg,
        })),
      });
      return;
    }
    next();
  };
}

// Reglas de validación reutilizables
export const validarRegistro = validate([
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es requerido")
    .isLength({ min: 2, max: 100 })
    .withMessage("Entre 2 y 100 caracteres"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El email es requerido")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("La contraseña es requerida")
    .isLength({ min: 8 })
    .withMessage("Mínimo 8 caracteres")
    .matches(/[A-Z]/)
    .withMessage("Debe tener al menos una mayúscula")
    .matches(/[0-9]/)
    .withMessage("Debe tener al menos un número")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Debe tener al menos un carácter especial (@#$%...)"),
]);

export const validarLogin = validate([
  body("email").trim().isEmail().withMessage("Email inválido").normalizeEmail(),
  body("password").notEmpty().withMessage("La contraseña es requerida"),
]);

export const validarConsulta = validate([
  body("pregunta").isString().trim().isLength({ min: 3, max: 2000 }),
  body("historial").optional().isArray({ max: 40 }),
]);

export const validarConsultaStream = validate([
  body("pregunta").isString().trim().isLength({ min: 3, max: 2000 }),
  body("historial").optional().isArray({ max: 40 }),
]);
