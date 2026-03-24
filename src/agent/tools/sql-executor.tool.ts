import { tool } from "ai";
import { z } from "zod";
import pool from "../../config/database";
import { env } from "../../config/env";

interface SQLExecutorResult {
  exito: boolean;
  total_filas?: number;
  datos?: any[];
  sql_ejecutado?: string;
  error?: string;
  sql_intentado?: string;
}

// Operaciones que NUNCA se permiten sin importar nada
const SIEMPRE_BLOQUEADAS = ["drop", "truncate", "alter", "create"];

// Operaciones que requieren confirmacion del usuario
const REQUIEREN_CONFIRMACION = ["insert", "update", "delete"];

export const sqlExecutorTool = tool({
  description:
    "Ejecuta cualquier consulta SQL en MySQL: SELECT, INSERT, UPDATE o DELETE. " +
    "Para SELECT: ejecuta directamente. " +
    "Para INSERT, UPDATE, DELETE: primero llama con confirmado=false para mostrar el plan, " +
    "luego si el usuario confirma con 'si', llama de nuevo con confirmado=true para ejecutar." +
    "NUNCA ejecutar DROP, TRUNCATE, ALTER ni CREATE bajo ninguna circunstancia.",

  inputSchema: z.object({
    sql: z
      .string()
      .describe(
        "Consulta SQL valida para MySQL. Puede ser SELECT, INSERT, UPDATE o DELETE. Sin punto y coma al final.",
      ),
    descripcion: z.string().describe("Que hace esta consulta en una frase."),
    confirmado: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "true si el usuario ya confirmo explicitamente con 'si'. " +
        "Omitir o poner false en el primer intento de escritura.",
      ),
  }),

  execute: async ({ sql, descripcion, confirmado }) => {
    const sqlLower = sql.trim().toLowerCase().replace(/\s+/g, " ");

    // Bloqueo permanente — nunca se ejecutan
    for (const palabra of SIEMPRE_BLOQUEADAS) {
      const regex = new RegExp(`\\b${palabra}\\b`, "i");
      if (regex.test(sqlLower)) {
        return {
          exito: false,
          error: `Operacion '${palabra.toUpperCase()}' no permitida bajo ninguna circunstancia.`,
        };
      }
    }

    // Operaciones de escritura — requieren confirmacion
    const esEscritura = REQUIEREN_CONFIRMACION.some((p) =>
      new RegExp(`\\b${p}\\b`, "i").test(sqlLower),
    );

    if (esEscritura && !confirmado) {
      return {
        exito: false,
        error: "REQUIERE_CONFIRMACION",
      };
    }

    // Bloquear escritura directa en tabla usuarios (Esto lo hice por que no encripta la contraseña)
    if (esEscritura && sqlLower.includes('usuarios')) {
      return {
        exito: false,
        error: 'Para operaciones en la tabla usuarios usa la herramienta gestionarUsuario.',
      };
    }

    // Agregar LIMIT solo en SELECT
    let sqlFinal = sql.trim();
    if (sqlLower.startsWith("select") && !sqlLower.includes("limit")) {
      sqlFinal += ` LIMIT ${env.agent.db.maxRows}`;
    }

    try {
      const [filas] = await pool.query<any>(sqlFinal);
      const datos = Array.isArray(filas) ? filas : [filas];
      return {
        exito: true,
        total_filas: datos.length,
        datos,
        sql_ejecutado: sqlFinal,
      };
    } catch (e: any) {
      return { exito: false, error: e.message, sql_intentado: sqlFinal };
    }
  },
});