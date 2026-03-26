import { Router } from 'express';
import { importarDatos } from '../controllers/import.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/import
// Protegido — solo usuarios autenticados pueden importar datos
router.post('/', authMiddleware, importarDatos);
export default router;