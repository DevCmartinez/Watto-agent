import { tool } from "ai";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import pool from "../../config/database";
import { hashear } from "../../utils/hash.util";

export const usuarioExecutorTool = tool({
    description:
        "Gestiona usuarios del sistema: crear, actualizar o desactivar. " +
        "Usa esta herramienta en lugar de ejecutarSQL cuando la operacion involucre la tabla usuarios. " +
        "Maneja el cifrado de contraseñas automaticamente con bcrypt.",

    inputSchema: z.object({
        accion: z.enum(["crear", "actualizar", "desactivar"]).describe(
            "Tipo de operacion a realizar."
        ),
        datos: z.object({
            id: z.number().optional().describe("ID del usuario (requerido para actualizar/desactivar)"),
            nombre: z.string().optional(),
            email: z.string().optional(),
            password: z.string().optional().describe("Password en texto plano, se cifrara automaticamente"),
            rol: z.enum(["admin", "usuario"]).optional(),
        }),
        confirmado: z.boolean().optional().default(false),
    }),

    execute: async ({ accion, datos, confirmado }) => {
        if (!confirmado) {
            return { exito: false, error: "REQUIERE_CONFIRMACION" };
        }

        try {
            if (accion === "crear") {
                if (!datos.nombre || !datos.email || !datos.password) {
                    return { exito: false, error: "nombre, email y password son requeridos para crear un usuario." };
                }
                const hash = await hashear(datos.password);
                await pool.query<RowDataPacket[]>(
                    "INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)",
                    [datos.nombre, datos.email, hash, datos.rol || "usuario"]
                );
                return { exito: true, mensaje: `Usuario ${datos.nombre} creado exitosamente con password cifrado.` };
            }

            if (accion === "actualizar") {
                if (!datos.id) return { exito: false, error: "ID requerido para actualizar." };
                const campos: string[] = [];
                const valores: unknown[] = [];
                if (datos.nombre) { campos.push("nombre = ?"); valores.push(datos.nombre); }
                if (datos.email) { campos.push("email = ?"); valores.push(datos.email); }
                if (datos.password) { campos.push("password = ?"); valores.push(await hashear(datos.password)); }
                if (datos.rol) { campos.push("rol = ?"); valores.push(datos.rol); }
                if (campos.length === 0) return { exito: false, error: "No hay campos para actualizar." };
                valores.push(datos.id);
                await pool.query<RowDataPacket[]>(`UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`, valores);
                return { exito: true, mensaje: `Usuario ID ${datos.id} actualizado correctamente.` };
            }

            if (accion === "desactivar") {
                if (!datos.id) return { exito: false, error: "ID requerido para desactivar." };
                await pool.query<RowDataPacket[]>("UPDATE usuarios SET activo = 0 WHERE id = ?", [datos.id]);
                return { exito: true, mensaje: `Usuario ID ${datos.id} desactivado.` };
            }

            return { exito: false, error: "Accion no reconocida." };

        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : "Error desconocido";
            return { exito: false, error };
        }
    },
});