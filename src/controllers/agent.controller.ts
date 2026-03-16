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
export async function consultarStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { pregunta, historial = [] } = req.body;
        if (!pregunta || !pregunta.trim()) {
            sendError(res, 'La pregunta es requerida', 400); return;
        }
        await consultarAgenteStreaming(pregunta.trim(), res, historial as ModelMessage[]);
    } catch (e) { if (!res.headersSent) next(e); }
}