import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validarLogin, validarRegistro } from "../middlewares/validate.middleware";
import rateLimit from "express-rate-limit";

const router = Router();

/**
 * PROTECCIÓN CONTRA FUERZA BRUTA
 * Limita el número de intentos de autenticación por IP.
 *
 * Razonamiento de límites:
 * - windowMs: 15 minutos (900,000 ms) — ventana de tiempo para contar intentos
 * - max: 5 intentos — suficiente para usuarios legítimos que olvidan contraseña
 *
 * Importante: No usar 'keyGenerator' basado en usuario porque en login/registro
 * aún no tenemos el usuario autenticado. Usamos IP como identificador.
 *
 * Skip: No se excluye a nadie. Incluso administrators están limitados para prevenir
 * ataques de denegación de servicio o comprobación de cuentas admin.
 */
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP antes de bloquear
  standardHeaders: true, // Retorna headers estándar (X-RateLimit-*)
  legacyHeaders: false, // No incluye headers obsoletos
  keyGenerator: (req) => req.ip || 'unknown', // Identificador único por IP
  skip: () => false, // No saltar para nadie (aplicar a todos)
  message: {
    exitoso: false,
    mensaje:
      "Demasiados intentos de autenticación. Por seguridad, intente más tarde (15 min).",
  },
});

// RUTAS PÚBLICAS — PROTEGIDAS POR RATE LIMIT
// Aplica límite de intentos para prevenir ataques de fuerza bruta
router.post("/login", limiterAuth, validarLogin, authController.login);

// Registro también limitado para evitar spam y denegación de servicio
router.post("/registro", limiterAuth, validarRegistro, authController.registro);

// RUTAS PROTEGIDAS — Solo accesibles con token JWT válido
router.get("/perfil", authMiddleware, authController.perfil);

/**
 * Cierre de sesión (logout).
 * Elimina la cookie HttpOnly del token JWT en el cliente.
 * No requiere autenticación previa porque la cookie se borra igual.
 * @route POST /api/auth/logout
 */
router.post("/logout", authController.logout);

export default router;
