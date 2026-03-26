import { Router } from "express";
import authRoutes from "./auth.routes";
import agentRoutes from "./agent.routes";
import exportRoutes from "./export.routes";
import importRoutes from "./import.routes";

const router = Router();
router.use("/auth", authRoutes);
router.use("/agent", agentRoutes);
router.use("/export", exportRoutes);
router.use("/import", importRoutes);
export default router;
