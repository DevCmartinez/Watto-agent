import "dotenv/config";
import * as readline from "readline";
import app from "../app";
import { connectDatabase } from "../config/database";
import { inicializarAgente } from "../agent/tools/autonomus-agent.service";
import { env } from "../config/env";
import { mostrarBanner, c } from "./ui";
import { procesarComando } from "./commands";
import { procesarPregunta, historial } from "./chat";

async function iniciarCLI(): Promise<void> {
  process.on("unhandledRejection", (err: unknown) => {
    const error = err as { message?: string } | Error;
    const msg = (error.message || String(error)).toLowerCase();
    if (
      msg.includes("quota") ||
      msg.includes("resource_exhausted") ||
      msg.includes("429")
    ) {
      // No hacer nada — el catch del streaming ya maneja esto
    } else {
      console.error("Error no manejado:", error);
    }
  });

  console.log(c.tenue("Conectando a la base de datos..."));
  await connectDatabase();
  await inicializarAgente();
  const servidor = app.listen(env.port, () => {
    mostrarBanner(
      `http://localhost:${env.port}`,
      env.ai.modelo,
      env.agent.mode,
    );
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: c.prompt("Tu: "),
      terminal: true,
    });
    rl.prompt();

    rl.on("line", async (entrada: string) => {
      const txt = entrada.trim();
      if (!txt) {
        rl.prompt();
        return;
      }
      const resultado = await procesarComando(txt, historial);
      if (resultado === "salir") {
        rl.close();
        return;
      }
      if (resultado === "continuar") {
        rl.prompt();
        return;
      }
      await procesarPregunta(txt);
      rl.prompt();
    });
    rl.on("close", () => {
      servidor.close(() => {
        console.log(c.exito("Servidor cerrado."));
        process.exit(0);
      });
    });
    process.on("SIGINT", () => {
      console.log("");
      rl.close();
    });
  });
  servidor.on("error", (err: unknown) => {
    const error = err as { code?: string; message?: string };
    if (error.code === "EADDRINUSE")
      console.error(
        c.error(`
Puerto ${env.port} en uso. Cambia PORT en .env`),
      );
    else
      console.error(
        c.error(`
Error: ${error.message || String(err)}`),
      );
    process.exit(1);
  });
}

iniciarCLI().catch((err) => {
  console.error(c.error("Error critico:"), err);
  process.exit(1);
});
