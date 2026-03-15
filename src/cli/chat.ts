import { ModelMessage } from "ai";
import { env } from "../config/env";
import { Spinner } from "./spinner";
import {
  mostrarEtiqueta,
  mostrarTool,
  mostrarError,
  imprimirChunk,
  finRespuesta,
} from "./ui";
import { consultarAgenteStreaming } from "../agent/tools/autonomus-agent.service";

export const historial: ModelMessage[] = [];

export async function procesarPregunta(pregunta: string): Promise<void> {
  historial.push({ role: "user", content: pregunta.trim() });
  const spinner = new Spinner(`${env.agent.name} esta pensando...`);
  let spinnerDetenido = false;
  let respuestaFull = "";
  spinner.start();

  // Objeto que imita Response de Express pero escribe en la terminal
  const fakeRes: any = {
    setHeader: () => { },
    end: () => {
      if (!spinnerDetenido) {
        spinner.stop();
        spinnerDetenido = true;
      }
    },
    write: (data: string) => {
      try {
        const linea = data.replace(/^data: /, "").trim();
        if (!linea) return;
        const evento = JSON.parse(linea);
        if (evento.tipo === "texto") {
          if (!evento.chunk || !evento.chunk.trim()) return;
          if (!spinnerDetenido) {
            spinner.stop();
            spinnerDetenido = true;
            mostrarEtiqueta();
          }
          imprimirChunk(evento.chunk);
          respuestaFull += evento.chunk;
        }
        if (evento.tipo === "tool") {
          spinner.stop();
          spinnerDetenido = true;
          mostrarTool(evento.nombre);
          spinner.start();
          spinnerDetenido = false;
        }
        if (evento.tipo === "fin") {
          if (!spinnerDetenido) {
            spinner.stop();
            spinnerDetenido = true;
          }
          finRespuesta(evento.tokens);
          if (respuestaFull.trim())
            historial.push({ role: "assistant", content: respuestaFull });
          if (historial.length > 6) historial.splice(0, historial.length - 6);
        }
        if (evento.tipo === "error") {
          spinner.stop();
          spinnerDetenido = true;

          const msg = evento.mensaje?.toLowerCase() || "";
          if (
            msg.includes("quota") ||
            msg.includes("429") ||
            msg.includes("rate limit") ||
            msg.includes("resource_exhausted") ||
            msg.includes("limite")
          ) {
            mostrarError(
              "Limite de consultas alcanzado. Espera unos minutos e intenta de nuevo.",
            );
          } else {
            mostrarError(
              "Ocurrio un error al procesar tu consulta. Intenta de nuevo.",
            );
          }
          historial.pop();
        }
      } catch {
        /* ignorar JSON malformado */
      }
    },
  };
  await consultarAgenteStreaming(pregunta.trim(), fakeRes, historial);
}
