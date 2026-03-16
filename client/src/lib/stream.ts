import { useAuthStore } from '@/stores/authStore';

// Tipos de eventos que envia el backend
export type StreamEventType = 'texto' | 'tool' | 'fin' | 'error';

export interface StreamEvent {
    tipo: StreamEventType;
    chunk?: string; // Para tipo='texto'
    nombre?: string; // Para tipo='tool'
    tokens?: number; // Para tipo='fin'
    mensaje?: string; // Para tipo='error'
}

// Mensaje del historial de conversacion
export interface MensajeHistorial {
    role: 'user' | 'assistant';
    content: string;
}

// Callbacks que se llaman segun el evento
export interface StreamCallbacks {
    onChunk: (chunk: string) => void;// Nuevo fragmento de texto
    onTool: (nombre: string) => void; // El agente esta usando un tool
    onFin: (tokens: number) => void; // Respuesta completa
    onError: (mensaje: string) => void; // Error
}

// Funcion principal para hacer streaming al agente
export async function streamAgente(
    pregunta: string,
    historial: MensajeHistorial[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal // Para cancelar el stream
): Promise<void> {
    const token = useAuthStore.getState().token;
    const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pregunta, historial }), signal, // AbortSignal para cancelar
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        callbacks.onError(data.mensaje || 'Error al conectar con el agente');
        return;
    }
    if (!response.body) {
        callbacks.onError('El servidor no devolvio un stream');
        return;
    }

    // Leer el stream linea por linea
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Guardar linea incompleta
        for (const line of lines) {
            const dataLine = line.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            const trimmed = dataLine.slice(5).trim(); // quitar "data:" 
            if (!trimmed) continue;
            try {
                const evento: StreamEvent = JSON.parse(trimmed);
                switch (evento.tipo) {
                    case 'texto':
                        if (evento.chunk) callbacks.onChunk(evento.chunk);
                        break;
                    case 'tool':
                        if (evento.nombre) callbacks.onTool(evento.nombre);
                        break;
                    case 'fin':
                        callbacks.onFin(evento.tokens ?? 0);
                        break;
                    case 'error':
                        callbacks.onError(evento.mensaje ?? 'Error desconocido');
                        break;
                }
            } catch {
                // Ignorar lineas que no sean JSON valido
            }
        }
    }
}