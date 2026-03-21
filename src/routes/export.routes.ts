import { Router } from 'express';
import { exportarArchivo } from '../controllers/export.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
// GET /api/export?sql=SELECT...&formato=xlsx&titulo=nombre
// Protegido con JWT — solo usuarios autenticados pueden exportar
router.get('/', authMiddleware, exportarArchivo);
export default router;