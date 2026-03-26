# 🔒 Auditoría de Seguridad & Performance — Proyecto Watto

> Revisión completa del código fuente. Sin cambios aplicados — solo diagnóstico documentado.
> Clasificación: **Crítica** 🔴 · **Alta** 🟠 · **Media** 🟡 · **Baja** 🟢 · **Optimización** 🔵

---

## RESUMEN EJECUTIVO

| Categoría | Crítica 🔴 | Alta 🟠 | Media 🟡 | Baja 🟢 | Optimiz. 🔵 |
|---|---|---|---|---|---|
| Seguridad | 2 | 3 | 4 | 2 | — |
| Performance | — | 1 | 2 | — | 4 |
| **Total** | **2** | **4** | **6** | **2** | **4** |

---

## 🔴 CRÍTICO — Acción Inmediata Requerida

### [SEC-01] 🔴 API Keys expuestas en `.env` commiteado
**Archivo:** `.env` (raíz del proyecto)  
**Riesgo:** El `.gitignore` incluye `.env` correctamente, pero el archivo **fue leído con credenciales reales activas**:
- `OPENAI_API_KEY=sk-proj-Pb9XAposY1fQVA...` — clave real de OpenAI
- `GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...` — clave real de Google AI
- `DB_PASSWORD=truque90` — password de base de datos
- `JWT_SECRET= M4r4cuy490**` — secret JWT (con espacio al inicio, posible bug)

**Acciones:**
1. Rota **inmediatamente** las API keys de OpenAI y Google desde sus paneles
2. Cambia el password de la base de datos
3. Regenera el JWT_SECRET (y fíjate que tiene un **espacio** antes del valor que puede causar bugs)
4. Verifica con `git log --all -- .env` que nunca fue incluido en commits

```bash
# Verificar si .env fue accidentalmente commiteado alguna vez
git log --all --full-history -- .env
```

---

### [SEC-02] 🔴 SQL Injection en `import.controller.ts` — Nombre de tabla sin sanitizar
**Archivo:** `src/controllers/import.controller.ts` — Línea 116

```typescript
// ❌ VULNERABLE: `tabla` viene del body del request sin validación
const sql = `INSERT INTO ${tabla} (${columnas}) VALUES (${placeholders})`;
```

El parámetro `tabla` viene directamente del cliente (`req.body`) y se inyecta en la query sin validará. Un atacante autenticado podría enviar:
- `tabla: "usuarios; DROP TABLE usuarios; --"`
- `tabla: "usuarios (password) SELECT password FROM usuarios WHERE 1=1 --"`

**Solución:** Validar contra una whitelist de tablas permitidas:

```typescript
// ✅ En importarEnBD(), antes de ejecutar:
const tablasPermitidas = await obtenerTablasBD(); // de schema-discovery
if (!tablasPermitidas.includes(tabla)) {
  throw new Error(`Tabla '${tabla}' no permitida para importación`);
}
```

---

## 🟠 ALTA — Corregir Pronto

### [SEC-03] 🟠 CORS completamente abierto (`app.use(cors())`)
**Archivo:** `src/app.ts` — Línea 25

```typescript
// ❌ Permite peticiones desde CUALQUIER origen
app.use(cors());
```

Esto permite que cualquier sitio web externo haga requests a tu API con las cookies/tokens del usuario.

**Solución:**
```typescript
// ✅ Restringir a orígenes conocidos
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tudominio.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

---

### [SEC-04] 🟠 SQL en query string del export — Manipulación posible
**Archivo:** `src/controllers/export.controller.ts` — Línea 38  
**Archivo:** `src/routes/export.routes.ts`

El SQL viaja como parámetro GET en la URL:
```
GET /api/export?sql=SELECT * FROM clientes&formato=xlsx
```

Problemas:
1. El SQL completo es visible en logs del servidor, proxies y historial del navegador
2. La validación `validarSQL()` usa regex pero puede ser bypasseada con comentarios SQL: `SELECT 1; /*` + técnicas de ofuscación
3. Un atacante que intercepte la URL puede modificar el SQL antes de que llegue al servidor

**Solución recomendada:** Cambiar a POST con body, o que el agente guarde el SQL en sesión/cache y solo devuelva un token temporal:
```typescript
// ✅ Opción simple: cambiar a POST
router.post('/generate', authMiddleware, exportarArchivo);
// El SQL va en req.body (encriptado en tránsito por HTTPS)
```

---

### [SEC-05] 🟠 `importarEnAPI` hace fetch a URLs arbitrarias sin validación
**Archivo:** `src/controllers/import.controller.ts` — Líneas 150 y 179

```typescript
// ❌ El `endpoint` viene del body del cliente
const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
const respuesta = await fetch(url, { method: 'POST', ... });
```

Aunque `baseUrl` viene de `.env`, el `endpoint` es controlado por el cliente. Un atacante puede usar path traversal (`../../otro-servicio`) para alcanzar endpoints internos de la red.

**Solución:**
```typescript
// ✅ Validar que endpoint no contenga traversal
const endpointLimpio = endpoint.replace(/\.\./g, '').replace(/^\/+/, '');
if (endpointLimpio !== endpoint.replace(/^\//, '')) {
  throw new Error('Endpoint inválido');
}
```

---

### [PERF-01] 🟠 Sin Rate Limiting en endpoints del agente
**Archivo:** `src/routes/agent.routes.ts`

No existe ningún rate limiter en `/api/agent/stream` ni `/api/agent/consultar`. Un usuario autenticado puede hacer miles de consultas por minuto, lo que puede:
1. Agotar la cuota de la API de IA (costo)
2. Saturar el pool de MySQL
3. Degradar la experiencia de otros usuarios

**Solución:** Instalar `express-rate-limit`:
```bash
npm install express-rate-limit
```
```typescript
// En agent.routes.ts
import rateLimit from 'express-rate-limit';
const limiterIA = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,   // 20 consultas por minuto por usuario
  keyGenerator: (req) => req.usuario?.id?.toString() ?? req.ip,
  message: { exitoso: false, mensaje: 'Demasiadas consultas. Espera un momento.' }
});
router.post('/stream', authMiddleware, limiterIA, validarConsultaStream, agentCtrl.consultarStream);
```

---

## 🟡 MEDIA — Buenas Prácticas a Implementar

### [SEC-06] 🟡 `error.middleware.ts` filtra mensajes de error internos en producción pero no completamente
**Archivo:** `src/middlewares/error.middleware.ts` — Línea 45

```typescript
// ❌ err.message puede contener detalles de la BD incluso en producción
// cuando el error no es de tipo "desarrollo"
res.status(codigo || 500).json({
  exitoso: false,
  mensaje: err.message || "Error interno del servidor", // ← siempre expuesto
  error: process.env.NODE_ENV === "development" ? err.message : undefined,
});
```

El campo `mensaje` siempre envía `err.message` al cliente, lo que puede incluir errores de MySQL como `Table 'nodejs.X' doesn't exist` — información sensible.

**Solución:**
```typescript
// ✅ En producción, mensaje genérico para errores 500
const esProduccion = process.env.NODE_ENV === 'production';
res.status(codigo || 500).json({
  exitoso: false,
  mensaje: (codigo && codigo < 500) ? err.message : (esProduccion ? 'Error interno del servidor' : err.message),
});
```

---

### [SEC-07] 🟡 JWT Secret con espacio inicial (bug potencial)
**Archivo:** `.env` — Línea 19

```
JWT_SECRET= M4r4cuy490**
#           ^ ESPACIO AQUÍ
```

`process.env.JWT_SECRET` tendrá el valor `" M4r4cuy490**"` (con espacio). Esto no rompe el sistema (los tokens se firman y verifican con el mismo valor), pero es un indicador de que el secret no fue generado criptográficamente.

**Solución:** Usar un secret de 32+ bytes generado aleatoriamente:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Y en .env: JWT_SECRET=a1b2c3d4... (sin espacios)
```

---

### [SEC-08] 🟡 `NODE_ENV` con valor no estándar "Tatooine"
**Archivo:** `.env` — Línea 5

```
NODE_ENV=Tatooine
```

Muchas librerías (incluyendo Express y el `error.middleware.ts` propio) verifican `NODE_ENV === 'production'` o `NODE_ENV === 'development'`. Con "Tatooine" el middleware de errores **nunca activará el modo producción**, siempre exponiendo detalles de errores.

**Solución:** Usar `development` para local, `production` en servidor:
```
NODE_ENV=development
```

---

### [SEC-09] 🟡 `authStore` persiste JWT en `localStorage` (XSS risk)
**Archivo:** `client/src/stores/authStore.ts` — Líneas 31-33

```typescript
persist((...), { name: 'watto-auth' }) // Guarda token en localStorage
```

`localStorage` es accesible por cualquier JS que se ejecute en la página. Si existe alguna vulnerabilidad XSS (en librerías de terceros, por ejemplo), el token JWT puede ser robado.

**Solución alternativa (más segura):** Usar `sessionStorage` en lugar de `localStorage`, o cookies HttpOnly si el backend es del mismo dominio. Para este proyecto, como mínimo, reducir el TTL del JWT a 1-2 horas:
```
JWT_EXPIRES_IN=2h  # en lugar de 24h
```

---

### [PERF-02] 🟡 `console.error` global silenciado durante el streaming
**Archivo:** `src/agent/tools/autonomus-agent.service.ts` — Líneas 162-163

```typescript
// ❌ PELIGROSO: silencia TODOS los errores del proceso durante el stream
const originalConsoleError = console.error;
console.error = () => { };
```

Esto suprime errores críticos de otras partes del servidor que puedan ocurrir simultáneamente mientras hay un stream activo. Si el pool de MySQL lanza un error durante este tiempo, no se logeará.

**Solución:** Filtrar solo errores específicos del SDK de IA:
```typescript
// ✅ No suprimir console.error globalmente — el SDK ya maneja sus errores internamente
// Simplemente eliminar esas líneas — el código funciona igual sin ellas
```

---

### [PERF-03] 🟡 Import de datos: `fetch` secuencial fila por fila sin concurrencia
**Archivo:** `src/controllers/import.controller.ts` — Líneas 169-194

```typescript
// ❌ Un POST por cada fila, de forma completamente secuencial
for (let i = 0; i < datos.length; i++) {
  await fetch(url, { method: 'POST', body: JSON.stringify(body) });
}
```

Con 500 filas y una latencia de red de 100ms por request = **50 segundos** de espera.

**Solución:** Procesamiento en lotes concurrentes:
```typescript
// ✅ Procesar en lotes de 5 requests paralelos
const CONCURRENCIA = 5;
for (let i = 0; i < datos.length; i += CONCURRENCIA) {
  const lote = datos.slice(i, i + CONCURRENCIA);
  await Promise.allSettled(lote.map(fila => procesarFila(fila)));
}
```

---

## 🟢 BAJA — Mejoras Menores

### [SEC-10] 🟢 Bug silencioso en `ChatPage.tsx` — archivo cargado pero no enviado
**Archivo:** `client/src/pages/ChatPage.tsx` — Línea 49

```typescript
// ❌ Esta línea no hace nada (llamada sin ejecutar)
const archivo = await leerArchivo(file);
enviarMensajeConArchivo;  // ← referencia a función, NO una llamada
```

Aunque en la línea 63 sí se llama correctamente, la línea 49 es código muerto que confunde. No es un riesgo de seguridad pero sí un bug latente.

**Solución:** Eliminar la línea 49 (`enviarMensajeConArchivo;`).

---

### [SEC-11] 🟢 `queueLimit: 0` en el pool de MySQL (sin límite de cola)
**Archivo:** `src/config/database.ts` — Línea 14

```typescript
queueLimit: 0, // Sin límite de cola de espera
```

En un escenario de alta carga, la cola de espera de conexiones puede crecer indefinidamente, consumiendo memoria hasta crashear el proceso. 

**Solución:**
```typescript
queueLimit: 50, // Máximo 50 peticiones en cola — las demás fallan rápido
```

---

## 🔵 OPTIMIZACIONES DE PERFORMANCE

### [OPT-01] 🔵 Cache del schema guardado en disco con `fs.writeFileSync` (bloqueante)
**Archivo:** `src/agent/tools/autonomus-agent.service.ts` — Línea 72

```typescript
// ❌ Operación bloqueante de I/O que congela el event loop
fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
```

**Solución:**
```typescript
// ✅ Usar versión asíncrona
await fs.promises.writeFile(CACHE_PATH, JSON.stringify(cache), 'utf-8');
```

---

### [OPT-02] 🔵 `validarConsulta` y `validarConsultaStream` son idénticos
**Archivo:** `src/middlewares/validate.middleware.ts` — Líneas 80-90

Ambos middlewares tienen exactamente la misma regla. Es duplicación de código.

**Solución:**
```typescript
// ✅ Un solo middleware, usado en ambas rutas
export const validarConsultaBase = validate([
  body("pregunta").isString().isLength({ min: 1, max: 2000 })
    .withMessage("La consulta no puede estar vacía o exceder los 2000 caracteres"),
]);
// En routes: usar validarConsultaBase en ambos endpoints
```

---

### [OPT-03] 🔵 `scrollIntoView` en cada render de mensajes (puede ser costoso)
**Archivo:** `client/src/pages/ChatPage.tsx` — Líneas 76-78

```typescript
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [mensajes]); // Se dispara en CADA cambio del array mensajes
```

Durante el streaming, `mensajes` cambia decenas de veces por segundo. Cada cambio dispara una animación de scroll, lo que puede causar jank en dispositivos lentos.

**Solución:** Usar `debounce` o solo hacer scroll cuando el último mensaje es del agente:
```typescript
useEffect(() => {
  const ultimo = mensajes[mensajes.length - 1];
  // Solo scroll automático si el agente está respondiendo
  if (ultimo?.rol === 'assistant') {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [mensajes]);
```

---

### [OPT-04] 🔵 `historial.slice(-8)` — contexto limitado, configurable sería mejor
**Archivo:** `client/src/hooks/useChat.ts` — Línea 49

El historial enviado al agente está fijo en 8 mensajes. Esto es razonable, pero debería ser una constante nombrada para facilitar ajustes:

```typescript
// ✅ Más mantenible
const MAX_HISTORIAL = 8;
const historialActual = mensajesRef.current
  .filter(m => !m.error && !m.cargando && m.contenido.trim())
  .slice(-MAX_HISTORIAL)
  .map(m => ({ role: m.rol, content: m.contenido }));
```

---

## ✅ LO QUE ESTÁ BIEN IMPLEMENTADO

Estos aspectos están correctamente implementados y **no requieren cambios**:

| Aspecto | Implementación |
|---|---|
| **Hashing de passwords** | bcrypt con 10 rounds — correcto |
| **Queries parametrizadas** | `pool.query('... WHERE id = ?', [id])` — previene SQL injection en el ORM |
| **Validación de entrada** | `express-validator` en todos los endpoints públicos |
| **Protección de rutas** | `authMiddleware` en todas las rutas sensibles |
| **Bloqueo DDL en el agente** | `DROP`, `TRUNCATE`, `ALTER`, `CREATE` bloqueados |
| **Confirmación de escrituras** | INSERT/UPDATE/DELETE requieren confirmación explícita |
| **Sanitización de datos del usuario** | Password eliminado del objeto retornado al cliente |
| **Helmet** | Headers de seguridad HTTP activos |
| **Límite de JSON** | `10mb` en `express.json()` |
| **AbortController en streams** | Correctamente implementado en cliente y API executor |
| **Separación de capas** | Controller → Service → Repository bien definido |
| **Variables de entorno tipadas** | `env.ts` valida y tipifica todas las variables críticas |
| **Error si falta .env** | El servidor no arranca si faltan variables críticas |

---

## 📋 PLAN DE ACCIÓN PRIORIZADO

```
INMEDIATO (hoy):
  [SEC-01] Rotar API Keys comprometidas (OpenAI, Google, DB, JWT)
  [SEC-02] Añadir whitelist de tablas en import.controller.ts

ESTA SEMANA:
  [SEC-03] Configurar CORS con origen específico
  [SEC-04] Cambiar export SQL a método POST
  [SEC-08] Corregir NODE_ENV a 'development'/'production'
  [PERF-01] Añadir rate limiting al agente
  [PERF-02] Eliminar supresión global de console.error

PRÓXIMO SPRINT:
  [SEC-05] Validar path traversal en importarEnAPI
  [SEC-06] Mejorar error.middleware para no exponer mensajes en prod
  [SEC-07] Regenerar JWT_SECRET correctamente
  [SEC-09] Evaluar sessionStorage vs localStorage para el token
  [SEC-11] Añadir queueLimit al pool de MySQL

MEJORAS CONTINUAS:
  [SEC-10] Eliminar línea muerta en ChatPage.tsx
  [OPT-01..04] Optimizaciones de performance menores
```
