import { Router } from "express";
import * as agentCtrl from "../controllers/agent.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validarConsulta, validarConsultaStream, validate } from "../middlewares/validate.middleware";
const router = Router();
// Estado del agente (publico — para verificar que esta listo)
router.get("/estado", agentCtrl.estado);
// Consulta completa — requiere login
router.post("/consultar", authMiddleware, validarConsulta, agentCtrl.consultar,);
// Consulta con streaming — requiere login
router.post("/stream", authMiddleware, validarConsultaStream, agentCtrl.consultarStream,);
export default router;
