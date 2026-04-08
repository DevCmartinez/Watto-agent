/**
 * @origin [src/agent/tools/sql-executor.tool.ts]
 * @calledBy El Agente IA en [autonomus-agent.service.ts] mediante el SDK de Vercel AI.
 * @description Herramienta crítica que permite al agente interactuar con la base de datos MySQL.
 * Incluye un sistema de seguridad de tres capas: 
 * 1. Bloqueo de comandos destructivos.
 * 2. Confirmación obligatoria para escrituras.
 * 3. Delegación de tablas sensibles (usuarios).
 */
import { tool } from "ai";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import pool from "../../config/database";
import { env } from "../../config/env";

/**
 * Operaciones de estructura DDL que están estrictamente prohibidas por seguridad.
 * Ningún usuario o agente puede ejecutar estas sentencias.
 */
const SIEMPRE_BLOQUEADAS = ["drop", "truncate", "alter", "create"];

/**
 * Operaciones DML que modifican datos y requieren el consentimiento explícito del usuario ('si/no').
 */
const REQUIEREN_CONFIRMACION = ["insert", "update", "delete"];

/**
 * Definición de la Tool para el modelo de lenguaje.
 * Contiene la descripción semántica que la IA usa para decidir cuándo llamarla.
 */
export const sqlExecutorTool = tool({
  description:
    "Ejecuta cualquier consulta SQL en MySQL: SELECT, INSERT, UPDATE o DELETE. " +
    "Para SELECT: ejecuta directamente. " +
    "Para INSERT, UPDATE, DELETE: primero llama con confirmado=false para mostrar el plan, " +
    "luego si el usuario confirma con 'si', llama de nuevo con confirmado=true para ejecutar." +
    "NUNCA ejecutar DROP, TRUNCATE, ALTER ni CREATE bajo ninguna circunstancia.",

  // Definición del esquema de entrada que el LLM debe generar
  inputSchema: z.object({
    sql: z
      .string()
      .describe(
        "Consulta SQL válida para MySQL. Debe seguir el esquema de tablas descubierto. Sin punto y coma al final.",
      ),
    descripcion: z.string().describe("Breve explicación de qué pretende lograr esta consulta."),
    confirmado: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Indica si el usuario humano ya dio el visto bueno. false por defecto para escrituras.",
      ),
  }),

  /**
   * Lógica de ejecución de la herramienta.
   */
  execute: async ({ sql, descripcion, confirmado }) => {
    // Normalización para análisis de seguridad
    const sqlLower = sql.trim().toLowerCase().replace(/\s+/g, " ");

    // CAPA 1: Bloqueo de Comandos Destructivos (DDL)
    for (const palabra of SIEMPRE_BLOQUEADAS) {
      const regex = new RegExp(`\\b${palabra}\\b`, "i");
      if (regex.test(sqlLower)) {
        return {
          exito: false,
          error: `Seguridad: El comando '${palabra.toUpperCase()}' está restringido para el agente.`,
        };
      }
    }

    // CAPA 2: Detección de patrones de inyección SQL comunes
    const patronesPeligrosos = [
      /\bunion\b/i,                // UNION SELECT para extraer datos no autorizados
      /--\s*$/,                    // Comentario SQL (fin de línea)
      /#/,                         // Comentario MySQL
      /\/\*[\s\S]*\*\//,           // Comentario multilínea
      /information_schema/i,       // Acceso a metadatos de BD
      /sys\.[a-z0-9_]+/i,          // Tablas del sistema (mysql, performance_schema)
      /char\s*\(/i,                // Funciones de ofuscación
      /sleep\s*\(/i,               // Ataques DoS
      /benchmark\s*\(/i,           // Ataques DoS
      /load_file\s*\(/i,           // Lectura de archivos del servidor
      /into\s+outfile/i,           // Escritura de archivos en servidor
      /xp_cmdshell/i,              // Ejecución de comandos (SQL Server, por si acaso)
    ];

    for (const regex of patronesPeligrosos) {
      if (regex.test(sqlLower)) {
        return {
          exito: false,
          error: 'Consulta rechazada por seguridad: posible inyección SQL detectada.',
        };
      }
    }

    // Identificar si la consulta pretende alterar datos
    const esEscritura = REQUIEREN_CONFIRMACION.some((p) =>
      new RegExp(`\\b${p}\\b`, "i").test(sqlLower),
    );

    // CAPA 3: Solicitud de confirmación humana para INSERT/UPDATE/DELETE
    if (esEscritura && !confirmado) {
      return {
        exito: false,
        error: "REQUIERE_CONFIRMACION", // Este token es capturado por el servicio de streaming
      };
    }

    // CAPA 4: Protección de la tabla de usuarios
    // Se delega a 'usuario-executor.tool' para asegurar el hashing de contraseñas
    if (esEscritura && sqlLower.includes('usuarios')) {
      return {
        exito: false,
        error: 'Las modificaciones en la tabla usuarios deben realizarse mediante la herramienta gestionarUsuario.',
      };
    }

    // Optimización: Agregar LIMIT automático a los SELECT si no lo tienen
    let sqlFinal = sql.trim();
    if (sqlLower.startsWith("select") && !sqlLower.includes("limit")) {
      sqlFinal += ` LIMIT ${env.agent.db.maxRows}`;
    }

    try {
      // Ejecución real en el pool de conexiones de MySQL
      const [filas] = await pool.query<RowDataPacket[]>(sqlFinal);
      const datos: unknown[] = Array.isArray(filas) ? filas : [filas];

      return {
        exito: true,
        total_filas: datos.length,
        datos,
        sql_ejecutado: sqlFinal,
      };
    } catch (e: unknown) {
      // Captura de errores de sintaxis o de base de datos
      const error = e instanceof Error ? e.message : "Error desconocido";
      return {
        exito: false,
        error: `Error de base de datos: ${error}`,
        sql_intentado: sqlFinal,
      };
    }
  },
});