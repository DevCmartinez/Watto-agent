import { Router } from "express";
import authRoutes from "./auth.routes";
import agentRoutes from "./agent.routes";
import exportRoutes from "./export.routes";

const router = Router();
router.use("/auth", authRoutes);
router.use("/agent", agentRoutes);
router.use("/export", exportRoutes);
export default router;
