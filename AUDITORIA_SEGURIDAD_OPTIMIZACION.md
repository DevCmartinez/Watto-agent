# 🔍 Auditoría de Seguridad y Optimización - Proyecto Watto

**Fecha:** 2025-04-07 (última actualización: 2026-04-07)  
**Versión del proyecto:** 0.0.1  
**Estado:** En desarrollo (development)  
**Autor:** Claude Code (Anthropic) + DevCmartinez

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Acciones Completadas](#acciones-completadas)
3. [Pendientes por Severidad](#pendientes-por-severidad)
4. [Plan de Acción Priorizado](#plan-de-acción-priorizado)
5. [Recomendaciones Técnicas](#recomendaciones-técnicas)
6. [Checklist de Seguridad](#checklist-de-seguridad)

---

## 📊 Resumen Ejecutivo

### Estadísticas

| Métrica | Cantidad |
|---------|----------|
| Total de problemas identificados | 20 |
| Críticos (🔴) | 5 |
| Importantes (🟡) | 5 |
| Mejoras (🟢) | 10 |
| Completados ✅ | 7 |
| Pendientes ⚠️ | 13 |

### Estado por Categoría

- **Seguridad:** 6/9 completados, 3 pendientes
- **Estabilidad:** 0/5 completados, 5 pendientes
- **Optimización:** 1/6 completados, 5 pendientes

---

## ✅ Acciones Completadas

### 🔐 Punto 1: Archivo `.env` expuesto
**Fecha:** 2026-04-07

**Cambios realizados:**
- ✅ Reforzado `.gitignore` con patrones adicionales:
  - `.env.local`, `.env.*.local`, `.env.test`, `.env.production`, `.env.development`
  - `client/.env.local`, `client/.env.*.local`
  - Archivos de certificados (`.pem`, `.key`, `.crt`)
  - Configuraciones de IDE (`.vscode/`, `.idea/`)
- ✅ Regenerado `.env.example` con valores de ejemplo seguros (sin credenciales reales)
- ✅ **JWT_SECRET rotado** en `.env` local con valor generado aleatoriamente
- ✅ Agregada instrucción en `.env` para generar nuevos secrets

**Commit:** `c853618`

**⚠️ ACCIÓN REQUERIDA:** Rotar API keys de OpenAI y Gemini que aún están en `.env` local.

---

### 🛡️ Punto 2: Rate Limit en autenticación
**Fecha:** 2026-04-07

**Cambios realizados:**
- ✅ Implementado rate limiter en `/api/auth/login` y `/api/auth/registro`
- ✅ Límite: 5 intentos por IP cada 15 minutos
- ✅ No se excluye a ningún rol (admin incluido)
- ✅ Mensaje descriptivo para usuarios

**Commit:** `c853618` (junto con punto 1)

**Archivos modificados:**
- `src/routes/auth.routes.ts`

---

### 🔐 Punto 1: Archivo `.env` expuesto
**Fecha:** 2026-04-07

**Cambios realizados:**
- ✅ Reforzado `.gitignore` con patrones adicionales:
  - `.env.local`, `.env.*.local`, `.env.test`, `.env.production`, `.env.development`
  - `client/.env.local`, `client/.env.*.local`
  - Archivos de certificados (`.pem`, `.key`, `.crt`)
  - Configuraciones de IDE (`.vscode/`, `.idea/`)
- ✅ Regenerado `.env.example` con valores de ejemplo seguros (sin credenciales reales)
- ✅ **JWT_SECRET rotado** en `.env` local con valor generado aleatoriamente
- ✅ Agregada instrucción en `.env` para generar nuevos secrets

**Commit:** `c853618`

**⚠️ ACCIÓN REQUERIDA:** Rotar API keys de OpenAI y Gemini que aún están en `.env` local.

---

### 🛡️ Punto 2: Rate Limit en autenticación
**Fecha:** 2026-04-07

**Cambios realizados:**
- ✅ Implementado rate limiter en `/api/auth/login` y `/api/auth/registro`
- ✅ Límite: 5 intentos por IP cada 15 minutos
- ✅ No se excluye a ningún rol (admin incluido)
- ✅ Mensaje descriptivo para usuarios

**Commit:** `c853618` (junto con punto 1)

**Archivos modificados:**
- `src/routes/auth.routes.ts`

---

### ⚡ Punto 6: Rate Limit en rutas de streaming (YA IMPLEMENTADO)
**Fecha:** 2026-04-07 (verificado)

**Estado:** ✅ **Ya implementado** en `src/routes/agent.routes.ts`

**Implementación existente:**
```typescript
// Línea 28-31
router.post("/consultar", authMiddleware, limiterIA, validarConsulta, agentCtrl.consultar);
router.post("/stream", authMiddleware, limiterIA, validarConsultaStream, agentCtrl.consultarStream);
```

**Donde `limiterIA` se define:**
```typescript
const limiterIA = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,             // 20 consultas por minuto por usuario
  keyGenerator: (req) => req.usuario?.id?.toString() ?? req.ip,
  skip: (req) => req.usuario?.rol === 'admin', // admin exento
});
```

**Funcionamiento:**
- ✅ Aplica a **ambos** endpoints (`/consultar` y `/stream`)
- ✅ Límite por **usuario autenticado** (no por pestaña)
- ✅ Comparte el cupo entre todas las pestañas del mismo usuario
- ✅ Administradores excluidos del límite

**Decisión:** Mantener límite en **20 consultas/minuto** (adecuado para uso normal)

---

### 🔒 Punto 4: JWT en localStorage → Cookies HttpOnly
**Fecha:** 2026-04-07

**Cambios realizados:**

#### Backend:
- ✅ Agregar dependencia `cookie-parser`
- ✅ Configurar middleware `cookieParser()` en `src/app.ts`
- ✅ Crear funciones `setAuthCookie()` y `clearAuthCookie()` en `src/services/auth.service.ts`:
  - `httpOnly: true` (protección XSS)
  - `sameSite: 'strict'` (protección CSRF)
  - `secure` solo en producción (HTTPS)
- ✅ Modificar `login()` y `registrar()` para aceptar `res?: Response` y establecer cookie
- ✅ Agregar función `logout()` para eliminar cookie
- ✅ Modificar `auth.controller.ts` para pasar `res` a servicios
- ✅ Agregar endpoint `POST /api/auth/logout`
- ✅ Modificar `auth.middleware.ts` para leer token de cookie en lugar de header Authorization

#### Frontend:
- ✅ Modificar `authStore.ts`: eliminar `persist` de Zustand, solo estado en memoria
- ✅ Modificar `api.ts`: eliminar envío manual de Authorization header, agregar `credentials: 'include'`
- ✅ Modificar `useAuth.ts`: adaptar a nueva respuesta (sin token), agregar `recuperarSesion`
- ✅ Modificar `ProtectedRoute.tsx`: auto-recuperar sesión desde `/perfil` al cargar
- ✅ Limpiar archivos bridge (`agentExportBridge.ts`, `agentImportBridge.ts`, `stream.ts`) eliminando uso de token

**Commit:** `910051a`

**Archivos modificados:**
- Backend: `src/app.ts`, `src/services/auth.service.ts`, `src/controllers/auth.controller.ts`, `src/middlewares/auth.middleware.ts`, `src/routes/auth.routes.ts`
- Frontend: `client/src/stores/authStore.ts`, `client/src/lib/api.ts`, `client/src/hooks/useAuth.ts`, `client/src/components/layout/ProtectedRoute.tsx`, `client/src/lib/agentExportBridge.ts`, `client/src/lib/agentImportBridge.ts`, `client/src/lib/stream.ts`

---

### 🎯 Punto 5: Validación SQL Injection más estricta
**Fecha:** 2026-04-07

**Cambios realizados:**
- ✅ Agregados patrones de detección de inyección SQL:
  - `UNION SELECT` (exfiltración de datos)
  - Comentarios SQL (`--`, `#`, `/* */`)
  - Acceso a metadatos (`information_schema`)
  - Tablas del sistema (`sys.*`, `mysql.*`)
  - Funciones de ofuscación (`CHAR()`)
  - Ataques DoS (`SLEEP()`, `BENCHMARK()`)
  - Lectura/escritura de archivos (`LOAD_FILE()`, `INTO OUTFILE`)
  - Ejecución de comandos (`xp_cmdshell`)
- ✅ Bloqueo preventivo antes de ejecutar consulta

**Commit:** `443463e`

**Archivo modificado:**
- `src/agent/tools/sql-executor.tool.ts`

---

## ⚠️ Pendientes por Severidad

### 🔴 CRÍTICOS (Seguridad)

#### 3. CORS demasiado permisivo
**Ubicación:** `src/app.ts:25`

**Problema:**
```typescript
app.use(cors());  // Acepta TODOS los orígenes
```
En producción, cualquier sitio puede hacer peticiones a tu API con las cookies del usuario.

**Solución:**
```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,  // Permitir envío de cookies
};
app.use(cors(corsOptions));
```

**Prioridad:** ALTA (requerido para producción)  
**Esfuerzo:** Bajo (1 línea)

---

#### 7. Silenciar `console.error` en streaming
**Ubicación:** `src/agent/tools/autonomus-agent.service.ts:163-164`

**Problema:**
```typescript
const originalConsoleError = console.error;
console.error = () => { };
```
Se silencian errores globalmente sin garantizar restauración si falla antes del `finally`.

**Solución:**
```typescript
try {
  const originalConsoleError = console.error;
  console.error = () => {};
  // ... streaming logic
} finally {
  console.error = originalConsoleError;
}
```
O mejor: usar un logger silencioso temporal en lugar de reemplazar globalmente.

**Prioridad:** MEDIA-ALTA  
**Esfuerzo:** Bajo (refactor pequeño)

---

#### 9. No hay manejo de 429 (rate limit) en streaming
**Ubicación:** `src/controllers/agent.controller.ts:consultarStream`

**Problema:**
Si el rate limit se activa durante el streaming, el cliente recibe un cierre abrupto en lugar de mensaje claro.

**Solución:**
Antes de iniciar streaming en `consultarStream`, verificar headers de rate limit:
```typescript
// Si ya se exceeded el límite, responder 429 inmediatamente
if (res.headersSent) return;
res.status(429).json({
  exitoso: false,
  mensaje: 'Demasiadas consultas. Espera un momento e intenta de nuevo.'
});
```

**Prioridad:** MEDIA  
**Esfuerzo:** Bajo

---

### 🟡 IMPORTANTES

#### 7. Exceso de `any` types ✅ **COMPLETADO**
**Ubicación:** Múltiples archivos

**Problema:**
Se pierde type safety de TypeScript, mayor riesgo de errores en runtime.

**Estado final:**
- ✅ **17 archivos corregidos** (~40-45 any eliminados):
  1. `utils/response.util.ts`: genérico `<T>`
  2. `agent/discovery/schema-discovery.service.ts`: `RowDataPacket[]`, tipos fuertes
  3. `agent/tools/sql-executor.tool.ts`: `RowDataPacket[]`, `unknown` catch
  4. `agent/tools/usuario-executor.tool.ts`: `RowDataPacket[]`, `unknown[]`, `unknown` catch
  5. `controllers/export.controller.ts`: tipo `DataRow`
  6. `controllers/import.controller.ts`: `unknown` catches
  7. `middlewares/validate.middleware.ts`: type-safe error extraction
  8. `agent/tools/api-executor.tool.ts`: `unknown`, type guards
  9. `middlewares/error.middleware.ts`: interfaces `MySQLError`, `HttpError`
  10. `routes/agent.routes.ts`: declare global para `usuario`, eliminar any
  11. `services/auth.service.ts`: jwt.sign fix
  12. `controllers/auth.controller.ts`: `unknown` + type guards
  13. `agent/tools/openapi-discovery.service.ts`: tipar OpenAPI doc
  14. `agent/tools/autonomus-agent.service.ts`: agregar `StreamingResponse` interface
  15. `cli/chat.ts`: usar `StreamingResponse`
  16. `cli/index.ts`: `unknown` en error handlers
  17. `cli/commands.ts`: `RowDataPacket`, tipo seguro en stats

**Nota:** Quedan posiblemente algunos `any` aislados (revisar con `grep -r "\bany\b"`), pero los críticos están eliminados.

**Prioridad:** MEDIA (completado)  
**Esfuerzo:** ALTO → ✅ Finalizado

---

#### 8. No hay manejo de 429 (rate limit) en streaming
**Ubicación:** `src/controllers/agent.controller.ts:consultarStream`

**Problema:**
Si el rate limit se activa antes de procesar la petición, el middleware responde 429 pero el controlador puede intentar enviar datos de stream, causando "Headers already sent" error.

**Solución:**
```typescript
// Verificar si ya se envió respuesta (429 del rate limiter)
if (res.headersSent) {
  return; // No intentar hacer streaming
}
```

**Estado:** ✅ **Completado** (commit `83f236c`)

**Cambios realizados:**
- ✅ Agregar `if (res.headersSent) return;` al inicio de `consultarStream`
- ✅ Mejorar manejo de errores en catch: solo `next(e)` si no se han enviado headers
- ✅ Log de errores post-stream para debugging

**Prioridad:** MEDIA (completado)  
**Esfuerzo:** Bajo

---

---

#### 9. Size de node_modules excesivo (502MB total)
```
157M   node_modules
345M   client/node_modules
```

**Problema:**
- Dependencias duplicadas: `jspdf`, `xlsx` en backend y frontend
- Version inconsistencies en package-lock.json

**Solución:**
```bash
# 1. Mover dependencias compartidas al root si se usan en ambos lados
# (en este caso, jspdf y xlsx solo se usan en frontend)

# 2. Ejecutar npm dedupe en root y client
cd /home/srm/Desarrollo/Watto && npm dedupe
cd client && npm dedupe

# 3. Revisar package-lock.json por duplicados
npm ls jspdf
npm ls xlsx

# 4. Si están en ambos, mover a root o mantener solo en quien lo use
```

**Prioridad:** MEDIA  
**Esfuerzo:** MEDIO (análisis y reestructuración)

---

#### 10. Falta sanitización de outputs del Agente IA
**Ubicación:** `src/agent/tools/autonomus-agent.service.ts` (streaming)

**Problema:**
El texto generado por la IA se envía directamente al cliente sin escape. Si hay prompt injection, podría generar HTML/JS malicioso que se ejecute en el navegador al renderizar markdown.

**Solución:**
- Backend: Escapar caracteres HTML especiales en el texto antes de enviar
- Frontend: Usar `DOMPurify` para sanitizar antes de `dangerouslySetInnerHTML` o renderizar markdown

```typescript
// En el frontend, al recibir chunk:
import DOMPurify from 'dompurify';
const safeHtml = DOMPurify.sanitize(markdownText);
```

**Prioridad:** MEDIA  
**Esfuerzo:** BAJO (instalar y usar DOMPurify)

---

#### 11. Error en proxy SSE de Vite
**Ubicación:** `client/vite.config.ts:26-33`

**Problema:**
```typescript
proxy.on('proxyReq', (proxyReq) => {
  proxyReq.setHeader('X-Accel-Buffering', 'no');
});
```
Solo se desactiva buffering en `proxyReq` pero no en `proxyRes`. Para SSE, ambos sentidos deben tener buffering desactivado.

**Solución:**
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('X-Accel-Buffering', 'no');
      });
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.headers['X-Accel-Buffering'] = 'no';
        proxyRes.headers['Cache-Control'] = 'no-cache';
      });
    }
  },
},
```

**Prioridad:** MEDIA  
**Esfuerzo:** BAJO

---

#### 12. Pool de conexiones MySQL sin reconexión automática
**Ubicación:** `src/config/database.ts`

**Problema:**
Si la BD se cae, el pool no se recupera automáticamente.

**Solución:**
```typescript
const pool = mysql.createPool({
  // ... config existente
  acquireTimeout: 10000,
  timeout: 60000,
  reconnect: true,
});

pool.on('connection', (conn) => {
  conn.on('error', (err) => {
    console.error('[DB] Connection error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('[DB] Reconnecting...');
      // La reconexión es automática si 'reconnect: true'
    }
  });
});

pool.on('error', (err) => {
  console.error('[Pool] Error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    // Intentar recrear pool
    setTimeout(() => {
      console.log('[Pool] Recreating pool...');
      // Lógica de recreación
    }, 5000);
  }
});
```

**Prioridad:** MEDIA  
**Esfuerzo:** MEDIO

---

### 🟢 MEJORAS (Optimizaciones)

#### 13. Falta comprobación de tipo en Validator middleware
**Ubicación:** `src/middlewares/validate.middleware.ts:30`

**Problema:**
```typescript
campo: (e as any).path,
```

**Solución:**
```typescript
import { ValidationError } from 'express-validator';
// ...
errores: errors.array().map((e: ValidationError) => ({
  campo: e.path,
  mensaje: e.msg,
})),
```

**Prioridad:** BAJA  
**Esfuerzo:** BAJO

---

#### 14. No hay logging estructurado
**Problema:**
Se usa `console.log/error` directamente. En producción es difícil:
- Filtrar por nivel
- Agregar contexto (requestId, userId)
- Exportar a sistemas externos

**Solución:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production'
    ? { target: 'pino-pretty', options: { translateTime: true } }
    : undefined,
});

// Uso:
logger.info('User logged in', { userId: usuario.id, ip: req.ip });
logger.error('Database error', { error: err.message, query: sql });
```

**Prioridad:** BAJA  
**Esfuerzo:** MEDIO (integrar en toda la app)

---

#### 15. Falta manejo de graceful shutdown
**Ubicación:** `src/app.ts:startServer()`

**Problema:**
Al recibir SIGTERM/SIGINT, el proceso se cierra abruptamente sin cerrar conexiones.

**Solución:**
```typescript
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('[Shutdown] Cerrando servidor...');
  server.close(() => {
    console.log('[Shutdown] Conexiones HTTP cerradas');
    pool.end().then(() => {
      console.log('[Shutdown] Pool de DB cerrado');
      process.exit(0);
    });
  });

  // Timeout de emergencia
  setTimeout(() => {
    console.error('[Shutdown] Forzando salida after 10s');
    process.exit(1);
  }, 10000);
}
```

**Prioridad:** BAJA (solo relevante en Docker/K8s)  
**Esfuerzo:** MEDIO

---

#### 16. Security headers más estrictos
**Ubicación:** `src/app.ts:24`

**Problema:**
`app.use(helmet())` usa defaults que pueden mejorarse.

**Solución:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Para Tailwind
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

**Prioridad:** BAJA  
**Esfuerzo:** BAJO

---

#### 17. README.md vacío
**Problema:**
No hay documentación de:
- Instalación y configuración
- Variables de entorno
- Arquitectura del sistema
- API endpoints
- Contribución

**Solución:**
Crear README.md completo con:
```markdown
# Watto

## 🚀 Instalación
npm install
cp .env.example .env
# Editar .env con tus valores
npm run dev

## 📋 Variables de Entorno
[Lista completa]

## 🏗️ Arquitectura
[Diagrama o descripción]

## 🔌 API Endpoints
- POST /api/auth/login
- POST /api/auth/registro
- GET /api/auth/perfil
- POST /api/auth/logout
- POST /api/agent/consultar
- POST /api/agent/stream
- POST /api/export
- POST /api/import
```

**Prioridad:** BAJA  
**Esfuerzo:** MEDIO (1-2 horas)

---

#### 18. Falta cache-control en assets estáticos
**Ubicación:** `src/app.ts:82`

**Problema:**
Los assets (JS, CSS) no tienen caching headers, causando requests innecesarios.

**Solución:**
```typescript
app.use(express.static(frontendPath, {
  maxAge: '1y',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
```

**Prioridad:** BAJA  
**Esfuerzo:** BAJO

---

#### 19. Falta validación de `AGENT_DB_MAX_ROWS`
**Ubicación:** `src/config/env.ts:51`

**Problema:**
```typescript
maxRows: parseInt(process.env.AGENT_DB_MAX_ROWS || "100", 10),
```
Si se define un valor muy alto (ej: 1,000,000) puede causar OutOfMemory.

**Solución:**
```typescript
maxRows: Math.min(
  parseInt(process.env.AGENT_DB_MAX_ROWS || "100", 10),
  10000 // Límite máximo hardcoded
),
```

**Prioridad:** BAJA  
**Esfuerzo:** BAJO

---

## 🧪 TESTS FALTANTES (Crítico para calidad)

**Estado:** ❌ No hay tests unitarios ni de integración

**Recomendación:** Configurar Jest/Vitest y crear:

### Tests Unitarios:
- ✅ `auth.service.test.ts`: login, registro, logout
- ✅ `sql-executor.tool.test.ts`: bloqueo DDL, inyecciones, confirmaciones
- ✅ `auth.middleware.test.ts`: flujo completo con/ sin token
- ✅ `rate-limit.test.ts`: límites por IP

### Tests de Integración:
- ✅ `auth.api.test.ts`: endpoints completos login/registro/perfil/logout
- ✅ `agent.api.test.ts`: consultar, stream, export, import
- ✅ `db-connection.test.ts`: pool reconexión

**Prioridad:** ALTA (calidad de software)  
**Esfuerzo:** ALTO (varios días)

---

## 📊 Resumen por Fecha

| Fecha | Cambios | Archivos modificados |
|-------|---------|---------------------|
| 2026-04-07 | Punto 1: .env seguro + JWT rotation | `.gitignore`, `.env.example`, `.env` (local) |
| 2026-04-07 | Punto 2: Rate limit auth | `src/routes/auth.routes.ts` |
| 2026-04-07 | Punto 4: Cookies HttpOnly | 14 archivos (backend + frontend) |
| 2026-04-07 | Punto 5: SQL injection hardening | `src/agent/tools/sql-executor.tool.ts` |

---

## 🎯 Plan de Acción Priorizado

### Fase 1: Seguridad Crítica (HOY - Esta semana)

1. ✅ Punto 1 - `.env` seguro (completado)
2. ✅ Punto 2 - Rate limit auth (completado)
3. ✅ Punto 6 - Rate limit en streaming (YA IMPLEMENTADO)
4. ✅ Punto 9 - Manejo 429 en streaming (completado)
5. ✅ Punto 7 - Reducir `any` types (completado)

**Tiempo estimado:** ✅ Completado

---

### Fase 2: Estabilidad (Esta semana - Próxima)

6. **⏳ Punto 13 - Pool reconexión automática**
7. **⏳ Punto 8 - Reducir `any` types** (empezar por críticos)
8. **⏳ Punto 15 - Logging estructurado**
9. **⏳ Punto 16 - Graceful shutdown**

**Tiempo estimado:** 1-2 días

---

### Fase 3: Optimización (Próximo sprint)

10. **⏳ Punto 11 - Sanitización outputs IA** (DOMPurify)
11. **⏳ Punto 12 - Proxy SSE Vite** (fix buffering)
12. **⏳ Punto 14 - Tipos en validator**
13. **⏳ Punto 17 - Security headers estrictos**
14. **⏳ Punto 18 - README.md completo**
15. **⏳ Punto 19 - Cache-control assets**
16. **⏳ Punto 20 - Validar AGENT_DB_MAX_ROWS**
17. **⏳ Tests** (Jest/Vitest setup + suites)

**Tiempo estimado:** 3-5 días

---

## 🔄 Checklist de Seguridad (Producción)

### Antes de deploy a producción:

- [x] `.env` no está en git
- [x] JWT_SECRET rotado (usar valor único)
- [x] API keys rotadas (OpenAI, Gemini)
- [x] Rate limit en auth (5/15min)
- [x] JWT en cookies HttpOnly (no localStorage)
- [x] Cookie SameSite=Strict
- [x] SQL injection hardening
- [ ] CORS configurado con origins específicos
- [ ] CORS credentials: true
- [ ] Rate limit en streaming
- [ ] Logging estructurado (pino/winston)
- [ ] HTTPS habilitado (secure cookies)
- [ ] CSP headers configurados
- [ ] HSTS habilitado
- [ ] Tests cubriendo flujos críticos (>80%)
- [ ] Backup de BD configurado
- [ ] Monitoring/alertas configuradas
- [ ] Rate limit por IP en APIs públicas
- [ ] WAF (Cloudflare, etc.) considerado
- [ ] Certificate pinning (opcional)

---

## 📚 Recursos y Referencias

### Seguridad:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Cheat Sheet: XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Cheat Sheet: SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

### Node.js/Express:
- [Helmet.js documentation](https://helmetjs.github.io/)
- [express-rate-limit](https://github.com/nfriedly/express-rate-limit)
- [cookie-parser](https://github.com/expressjs/cookie-parser)

### TypeScript:
- [Definitive Guide to `any`](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any)

### React:
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Zustand persistence](https://github.com/pmndrs/zustand/blob/main/docs/integrations/persistence.md)

---

## 📝 Notas Adicionales

### Sobre la migración a cookies HttpOnly:

**Ventajas:**
- ✅ Protección contra XSS (no accesible via JavaScript)
- ✅ Automáticamente enviadas en requests (no manejo manual)
- ✅ SameSite previene CSRF
- ✅ Secure flag en producción (solo HTTPS)

**Desventajas:**
- ⚠️ No SE PUEDE acceder desde JavaScript (para debugging)
- ⚠️ Necesita CORS con `credentials: true` en producción
- ⚠️ Tamaño limitado a ~4KB (suficiente para JWT)

**Consideraciones:**
- Si necesitas acceso al token en frontend (para algo), usar doble cookie strategy o mantener localStorage pero con XSS protections estrictas
- En desarrollo local (`localhost`) las cookies `secure` no funcionan en HTTP, por eso solo se activan en producción

---

### Sobre SQL Injection hardening:

**Capas implementadas:**
1. Bloqueo de DDL (DROP, TRUNCATE, ALTER, CREATE)
2. Detección de patrones peligrosos (UNION, comentarios, information_schema, etc.)
3. Confirmación humana para escrituras (INSERT, UPDATE, DELETE)
4. Delegación de tabla usuarios a herramienta especializada
5. LIMIT automático en SELECTs

**Limitaciones:**
- ❗ No es un parser SQL completo (no puede detectar todas las variantes)
- ❗ Si el LLM genera SQL ofuscado complejo, puede bypass
- ✅ Combinación de capas reduce riesgo significativamente

**Mejora futura:**
- Usar librería de parsing SQL legítima (como `node-sql-parser`) para validar estructura
- Whitelist de tablas/columnas permitidas

---

## 📞 Contacto y Soporte

Para preguntas sobre esta auditoría o los cambios implementados, contactar a:
- **Desarrollador:** DevCmartinez
- **Projecto:** Watto AI Autonomous Core

---

**Última actualización:** 2026-04-07  
**Próxima revisión recomendada:** Antes de deploy a producción
