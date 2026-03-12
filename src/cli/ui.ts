import chalk from "chalk";
import { env } from "../config/env";

export const c = {
  titulo: chalk.bold.hex("#00d4ff"),
  prompt: chalk.bold.yellow,
  gemini: chalk.bold.hex("#4285f4"),
  respuesta: chalk.white,
  tool: chalk.hex("#9c27b0"),
  exito: chalk.bold.green,
  error: chalk.bold.red,
  tenue: chalk.gray,
  thinking: chalk.hex("#ff9800"),
};

export function mostrarBanner(host: string, modelo: string, modo: string): void {
  console.log('');
  console.log(c.titulo('==============================================='));
  console.log(c.titulo('--------------------WATTO----------------------'));
  console.log(c.titulo('==============================================='));
  console.log(c.exito(`Servidor: ${host}`));
  console.log(c.exito(`Modelo:${modelo}`));
  console.log(c.exito(`Modo:${modo.toUpperCase()}`));
  console.log(c.tenue('------------------------------------------------'));
  console.log(c.tenue('/ayuda | /refresh | /historial | /limpiar | /salir'));
  console.log(c.titulo('==============================================='));
  console.log('');
}

export const imprimirChunk = (chunk: string) => process.stdout.write(c.respuesta(chunk));
export const mostrarEtiqueta = () => process.stdout.write('' + c.gemini(`${env.agent.name}: `));
export const mostrarTool = (n: string) => { };
export const finRespuesta = (tokens: number) => { console.log(''); console.log(c.tenue(`[${tokens} tokens]`)); console.log(''); };
export const mostrarError = (m: string) => { console.log(''); console.log(c.error(`Error: ${m}`)); console.log(''); };