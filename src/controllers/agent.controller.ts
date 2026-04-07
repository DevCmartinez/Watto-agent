import { Request, Response, NextFunction } from 'express';
import { ModelMessage } from 'ai';
import { consultarAgente, consultarAgenteStreaming, obtenerEstado } from '../agent/tools/autonomus-agent.service';
import { sendSuccess, sendError } from '../utils/response.util';

// GET /api/agent/estado
export function estado(req: Request, res: Response): void {
    sendSuccess(res, obtenerEstado(), 'Estado del agente');
}

// POST /api/agent/consultar
export async function consultar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { pregunta, historial = [] } = req.body;
        if (!pregunta || !pregunta.trim()) {
            sendError(res, 'La pregunta es requerida', 400); return;
        }
        const resultado = await consultarAgente(pregunta.trim(), historial as ModelMessage[]);
        sendSuccess(res, {
            respuesta: resultado.texto, tokens: resultado.tokens,
            tiempo_ms: resultado.tiempoMs, modelo: process.env.AI_MODEL,
        }, 'Consulta procesada');
    } catch (e) { next(e); }
}

// POST /api/agent/stream
/**
 * @name consultarStream
 * @origin [src/controllers/agent.controller.ts]
 * @calledBy [src/routes/agent.routes.ts]
 * @description Recibe peticiones de stream, valida y llama a `consultarAgenteStreaming`.
 *
 * SEC-07: Verifica explícitamente si el rate limit ya respondió (429)
 * antes de intentar enviar_stream. Esto evita "Headers already sent" errors.
 */
export async function consultarStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Si ya se envió una respuesta (probablemente 429 del rate limiter),
    // no intentar hacer streaming — simplemente salir.
    if (res.headersSent) {
      console.log('[RateLimit] Petición rechazada antes de procesar ( headersSent=true )');
      return;
    }

    try {
        const { pregunta, historial = [] } = req.body;
        if (!pregunta || !pregunta.trim()) {
            sendError(res, 'La pregunta es requerida', 400);
            return;
        }
        await consultarAgenteStreaming(pregunta.trim(), res, historial as ModelMessage[]);
    } catch (e) {
        // Solo pasar al middleware de errores si aún no se han enviado headers
        if (!res.headersSent) {
            next(e);
        } else {
            // Si ya enviamos algo del stream, el error se maneja internamente
            // en consultarAgenteStreaming, no necesitamos hacer nada más
            console.error('[Stream] Error después de iniciar stream:', e);
        }
    }
}