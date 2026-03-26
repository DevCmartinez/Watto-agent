import { Router } from 'express';
import { exportarArchivo } from '../controllers/export.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
// POST /api/export  { sql, formato, titulo }
// SEC-04: POST para que el SQL no quede expuesto en URLs ni logs
// Protegido con JWT — solo usuarios autenticados pueden exportar
router.post('/', authMiddleware, exportarArchivo);
export default router;