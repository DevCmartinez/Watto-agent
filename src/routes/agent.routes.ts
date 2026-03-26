import { Router } from "express";
import * as agentCtrl from "../controllers/agent.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validarConsulta } from "../middlewares/validate.middleware";
import rateLimit from "express-rate-limit";

const router = Router();

/**
 * PERF-01: Rate limiter por usuario autenticado.
 * Máximo 20 consultas por minuto para proteger la cuota de IA y la BD.
 * Los administradores quedan excluidos del límite.
 */
const limiterIA = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20,             // 20 consultas por minuto por usuario
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as any).usuario?.id?.toString() ?? req.ip ?? 'unknown',
    skip: (req) => (req as any).usuario?.rol === 'admin',
    message: { exitoso: false, mensaje: 'Demasiadas consultas. Espera un momento e intenta de nuevo.' },
});

// Estado del agente (publico — para verificar que esta listo)
router.get("/estado", agentCtrl.estado);

// Consulta completa — requiere login + rate limit
router.post("/consultar", authMiddleware, limiterIA, validarConsulta, agentCtrl.consultar);

// Consulta con streaming — requiere login + rate limit
router.post("/stream", authMiddleware, limiterIA, validarConsulta, agentCtrl.consultarStream);

export default router;
