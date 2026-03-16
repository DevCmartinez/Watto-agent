import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { inicializarAgente } from "./agent/tools/autonomus-agent.service";
import routes from "./routes";
import * as path from 'path';
import * as fs from 'fs';
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

// ■■ Servir el Frontend ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
// Servir frontend compilado (solo en produccion o si SERVE_FRONTEND=true)
const servirFrontend = process.env.SERVE_FRONTEND === 'true' || process.env.NODE_ENV === 'production';
if (servirFrontend) {
  const frontendPath = path.join(__dirname, '..', 'dist', 'client');
  if (fs.existsSync(frontendPath)) {
    // Servir archivos estaticos (JS, CSS, imagenes)
    app.use(express.static(frontendPath));
    // Para cualquier ruta que no sea /api, servir el index.html
    // Esto permite que React Router maneje la navegacion
    app.get('/{*path}', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
      }
    });
    console.log('[Servidor] Frontend servido desde dist/client/');
  }
}

// ■■ Middleware de errores (siempre al final) ■■■■■■■■■■■■■■■■■■
app.use(errorMiddleware);

export default app;
