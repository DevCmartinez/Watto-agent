import { ModelMessage } from "ai";
import { c, mostrarError } from "./ui";
import pool from "../config/database";

export type ResultadoCmd = "continuar" | "salir" | "no_es_comando";

export async function procesarComando(
  entrada: string,
  historial: ModelMessage[],
): Promise<ResultadoCmd> {
  if (!entrada.startsWith("/")) return "no_es_comando";
  const cmd = entrada.trim().toLowerCase();

  switch (cmd) {
    case "/salir":
    case "/exit":
      console.log("");
      console.log(c.exito("Hasta luego!"));
      console.log("");
      return "salir";
    case "/ayuda":
    case "/help":
      console.log("");
      console.log(c.titulo("■■ COMANDOS ■■■■■■■■■■■■■■■■■■■■■■■■"));
      ["/ayuda", "/stats", "/historial", "/limpiar", "/salir"].forEach((cmd) =>
        console.log(c.tenue(`${cmd}`)),
      );
      console.log("");
      return "continuar";
    case "/stats":
      try {
        const [[rows]] = await pool.query<any>(
          "SELECT COUNT(*) as total FROM information_schema.tables WHERE table_schema = DATABASE()",
        );
        console.log("");
        console.log(
          c.titulo(`
Tablas en la BD: ${(rows as any)[0].total}`),
        );
        console.log("");
      } catch {
        mostrarError("No se pudo consultar estadisticas");
      }
      return "continuar";

    case "/historial":
      console.log("");
      if (historial.length === 0) {
        console.log(c.tenue("Historial vacio."));
      } else {
        historial.forEach((m, i) => {
          const contenido =
            typeof m.content === "string" ? m.content.slice(0, 70) : "...";
          const etiqueta =
            m.role === "user" ? c.prompt("Tu:") : c.gemini("Agente:");
          console.log(`${etiqueta}${c.tenue(contenido)}`);
        });
      }
      console.log("");
      return "continuar";
    case "/limpiar":
      historial.length = 0;
      console.log("");
      console.log(c.exito("Historial limpiado."));
      console.log("");
      return "continuar";
    default:
      mostrarError(`Comando desconocido: ${entrada}. Escribe /ayuda.`);
      return "continuar";
  }
}
