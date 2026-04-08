/**
 * @origin [src/app.ts]
 * @calledBy Iniciado por [src/index.ts] o directamente por scripts de node.
 * @description Orquestador central del backend. 
 * Se encarga de ensamblar los componentes de seguridad, rutas de API y el motor del Agente Watto.
 */
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser"; // SEC-01: Parsear cookies HttpOnly (XSS protection)
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { inicializarAgente } from "./agent/tools/autonomus-agent.service";
import routes from "./routes";
import * as path from 'path';
import * as fs from 'fs';
import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();

/**
 * CONFIGURACIÓN DE MIDDLEWARES GLOBALES
 */
app.use(helmet());                     // Protección de cabeceras HTTP (XSS, Clickjacking, etc.)
app.use(compression());                // PERF-06: Compresión gzip para respuestas grandes
app.use(cors());                       // Gestión de Intercambio de Recursos de Origen Cruzado
app.use(cookieParser()); // SEC-01: Habilitar lectura de cookies (para auth middleware)
app.use(express.json({ limit: "10mb" })); // Límite de carga de JSON (importante para reportes grandes)
app.use(express.urlencoded({ extended: true }));

/**
 * DEFINICIÓN DE RUTAS DE API
 * Todas las peticiones al backend deben comenzar con el prefijo /api
 */
app.use("/api", routes);

/**
 * ENDPOINT DE SALUD (Health Check)
 * Útil para monitores de tiempo de actividad (uptime) y balanceadores de carga.
 */
app.get("/health", (_, res) => res.json({ 
  ok: true, 
  agente: env.agent.name, 
  status: "operativo",
  timestamp: new Date().toISOString() 
}));

/**
 * PROCEDIMIENTO DE ARRANQUE DEL SERVIDOR
 * 1. Conecta con el Pool de MySQL.
 * 2. Descubre el esquema de la base de datos para el Agente.
 * 3. Inicia la escucha en el puerto configurado.
 */
export async function startServer(): Promise<void> {
  try {
    // Inicialización de la infraestructura
    await connectDatabase();
    await inicializarAgente(); // Descubre tablas, vistas y APIs

    app.listen(env.port, () => {
      console.log(`\x1b[32m[${env.agent.name}]\x1b[0m Consola de operaciones lista en: http://localhost:${env.port}`);
      console.log(`\x1b[34m[Entorno]\x1b[0m Ejecutando en modo: ${env.nodeEnv}`);
    });
  } catch (error) {
    console.error("\x1b[31m[Fallo Crítico]\x1b[0m No se pudo iniciar el ecosistema de Watto:", error);
    process.exit(1);
  }
}

// Ejecución automática si es el módulo principal
if (require.main === module) {
  startServer();
}

/**
 * SOPORTE PARA SINGLE PAGE APPLICATION (SPA)
 * Si el servidor está configurado para servir el frontend (dist/client),
 * se asegura de que cualquier ruta no-API devuelva el index.html de React.
 */
const servirFrontend = process.env.SERVE_FRONTEND === 'true' || process.env.NODE_ENV === 'production';
if (servirFrontend) {
  const frontendPath = path.join(__dirname, '..', 'dist', 'client');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath)); // Servir JS, CSS, Media estático
    
    // Captura de rutas 'catch-all' para el routing de React (History API)
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
      }
    });
    console.log('[Infra] Frontend integrado detectado y activo.');
  }
}

/**
 * MANEJO CENTRALIZADO DE ERRORES
 * Captura cualquier excepción no manejada en los controladores y devuelve un JSON estandarizado.
 */
app.use(errorMiddleware);

export default app;

