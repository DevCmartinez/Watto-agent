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

export const sqlExecutorTool = (tool as any)({
  description:
    "Ejecuta una consulta SQL SELECT en MySQL y retorna los resultados. " +
    "Solo usar para lectura de datos. Generar el SQL basandose en el " +
    "esquema de tablas disponible en el contexto.",
  parameters: z.object({
    sql: z
      .string()
      .describe(
        "Consulta SQL SELECT valida para MySQL. Sin punto y coma al final.",
      ),
    descripcion: z.string().describe("Que hace esta consulta en una frase."),
  }),
  execute: async ({
    sql,
    descripcion,
  }: {
    sql: string;
    descripcion: string;
  }): Promise<SQLExecutorResult> => {
    console.log(`[SQL] ${descripcion}`);
    console.log(`[SQL] ${sql}`);

    // Seguridad: solo SELECT
    const sqlLower = sql.trim().toLowerCase().replace(/\s+/g, " ");

    // if (!sqlLower.startsWith("select")) {
    //   return { exito: false, error: "Solo se permiten consultas SELECT." };
    // }
    // const palabrasBloqueadas = [
    //   "insert",
    //   "update",
    //   "delete",
    //   "drop",
    //   "truncate",
    //   "alter",
    //   "create",
    // ];
    // for (const palabra of palabrasBloqueadas) {
    //   const regex = new RegExp(`\\b${palabra}\\b`, "i");
    //   if (regex.test(sqlLower)) {
    //     return { exito: false, error: `Operacion '${palabra}' no permitida.` };
    //   }
    // }

    // Agregar LIMIT si no lo tiene
    let sqlFinal = sql.trim();
    if (!sqlLower.includes("limit")) {
      sqlFinal += ` LIMIT ${env.agent.db.maxRows}`;
    }

    try {
      const [filas] = await pool.query<any>(sqlFinal);
      const datos = Array.isArray(filas) ? filas : [filas];
      console.log(`[SQL] Resultado: ${datos.length} fila(s)`);
      return {
        exito: true,
        total_filas: datos.length,
        datos,
        sql_ejecutado: sqlFinal,
      };
    } catch (e: any) {
      console.error(`[SQL] Error: ${e.message}`);
      return { exito: false, error: e.message, sql_intentado: sqlFinal };
    }
  },
});
