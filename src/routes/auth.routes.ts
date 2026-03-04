import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validarLogin, validarRegistro } from "../middlewares/validate.middleware";

const router = Router();

//Rutas publicas
router.post("/login",validarLogin,authController.login);
router.post("/registro",validarRegistro,authController.registro,);
//Rutas protegidas
router.get("/perfil", authMiddleware, authController.perfil);
export default router;
