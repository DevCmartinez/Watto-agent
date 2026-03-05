import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { inicializarAgente } from "./agent/tools/autonomus-agent.service";
import routes from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();

// ■■ Middlewares de seguridad ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
app.use(helmet()); // Cabeceras de seguridad HTTP
app.use(cors()); // Permitir peticiones cross-origin
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ■■ Rutas ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
app.use("/api", routes);

// ■■ Health check publico ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
app.get("/health", (_, res) => res.json({ ok: true, env: env.nodeEnv }));

// ■■ Middleware de errores (siempre al final) ■■■■■■■■■■■■■■■■■■
app.use(errorMiddleware);

// ■■ Arrancar el servidor ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
// Esta funcion se usa cuando corres: npm run dev
export async function startServer(): Promise<void> {
  await connectDatabase();
  await inicializarAgente();
  app.listen(env.port, () => {
    console.log(`[${env.agent.name}] Hola! Forastero estoy corriendo en => http://localhost:${env.port}`);
    console.log(`[${env.agent.name}] En el sistema => ${env.nodeEnv}
`);
  });
}
// Solo arrancar si este archivo es el punto de entrada directo
// (no cuando es importado por el CLI)
if (require.main === module) {
  startServer().catch((err) => {
    console.error("[Servidor] Error critico:", err);
    process.exit(1);
  });
}
export default app;
