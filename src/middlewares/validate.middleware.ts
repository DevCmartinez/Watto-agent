/**
 * @origin [src/middlewares/validate.middleware.ts]
 * @description Capa de validación de esquemas de datos entrantes. 
 * Utiliza 'express-validator' para asegurar la integridad de la información antes de llegar a los controladores.
 */
import { Request, Response, NextFunction } from "express";
import { body, validationResult, ValidationChain } from "express-validator";

/**
 * Función genérica para ejecutar una serie de validaciones y responder en caso de error.
 * @param validations Un array de cadenas de validación (ValidationChain).
 * @returns Un middleware de Express que procesa las reglas.
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Ejecutar cada regla de validación de forma asíncrona
    for (const validation of validations) {
      await validation.run(req);
    }

    // 2. Extraer los resultados detallados
    const errors = validationResult(req);
    
    // 3. Si hay fallos, responder con HTTP 422 (Entidad no procesable)
    if (!errors.isEmpty()) {
      res.status(422).json({
        exitoso: false,
        mensaje: "Error de validación en los datos de entrada.",
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

/**
 * @name validarRegistro
 * @calledBy [auth.routes.ts] en POST /api/auth/registro
 * @description Reglas estrictas para el alta de usuarios:
 * - Nombre: 2-100 chars.
 * - Email: Formato válido y normalizado.
 * - Password: Robusta (8+ chars, Mayúscula, Número, Especial).
 */
export const validarRegistro = validate([
  body("nombre")
    .trim()
    .notEmpty().withMessage("El nombre es obligatorio")
    .isLength({ min: 2, max: 100 }).withMessage("El nombre debe tener entre 2 y 100 caracteres"),
  body("email")
    .trim()
    .notEmpty().withMessage("La dirección de correo electrónico es obligatoria")
    .isEmail().withMessage("Ingrese un formato de correo institucional válido (@...)")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("La contraseña es obligatoria")
    .isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres")
    .matches(/[A-Z]/).withMessage("Debe incluir al menos una letra mayúscula")
    .matches(/[0-9]/).withMessage("Debe incluir al menos un dígito numérico")
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage("Debe incluir al menos un carácter especial"),
]);

/**
 * @name validarLogin
 * @calledBy [auth.routes.ts] en POST /api/auth/login
 * @description Verificación mínima de formato para credenciales de acceso.
 */
export const validarLogin = validate([
  body("email").trim().isEmail().withMessage("Formato de correo no reconocido").normalizeEmail(),
  body("password").notEmpty().withMessage("Debe ingresar su contraseña corporativa"),
]);

/**
 * @name validarConsulta
 * @calledBy [agent.routes.ts] en POST /api/agent/consultar
 */
export const validarConsulta = validate([
  body("pregunta").isString().isLength({ min: 1, max: 2000 }).withMessage("La consulta no puede estar vacía o exceder los 2000 caracteres"),
]);

/**
 * @name validarConsultaStream
 * @calledBy [agent.routes.ts] en POST /api/agent/stream
 */
export const validarConsultaStream = validate([
  body("pregunta").isString().isLength({ min: 1, max: 2000 }).withMessage("La consulta no puede estar vacía o exceder los 2000 caracteres"),
]);

