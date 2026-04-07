
// Tipos de eventos que envia el backend
export type StreamEventType = 'texto' | 'tool' | 'fin' | 'error' | 'export_url' | 'import_ready';

export interface StreamEvent {
    tipo: StreamEventType;
    chunk?: string;// Para tipo='texto'
    nombre?: string;// Para tipo='tool'
    tokens?: number;// Para tipo='fin'
    mensaje?: string;// Para tipo='error'

    // Campos para tipo='export_url':
    // SEC-04: sql se envía directo (ya no como query string en URL)
    sql?: string;   // Consulta SQL a ejecutar en el servidor
    formato?: string;// xlsx | csv | pdf
    titulo?: string;// Nombre del archivo

    // Nuevos campos para importacion:
    destino?: 'bd' | 'api';
    tabla?: string;
    endpoint?: string;
    mapeo?: Record<string, string>;
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
    onExportUrl: (sql: string, formato: string, titulo: string) => void;
    onImportReady: (mapeo: Record<string, string>, destino: 'bd' | 'api', tabla?: string, endpoint?: string) => void;
}

// Funcion principal para hacer streaming al agente
/**
 * @name streamAgente
 * @origin [client/src/lib/stream.ts]
 * @calledBy [client/src/hooks/useChat.ts]
 * @description Implementa la lógica SSE para recibir y procesar chunks de un servidor.
 * Escucha eventos 'texto', 'tool', 'fin', 'error' y 'export_url'.
 */
export async function streamAgente(
    pregunta: string,
    historial: MensajeHistorial[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal // Para cancelar el stream
): Promise<void> {
    // SEC-01: No se envía token manual; la cookie HttpOnly se incluye automáticamente
    const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pregunta, historial }),
        signal, // AbortSignal para cancelar
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
                    case 'export_url':
                        // SEC-04: ahora recibimos sql en lugar de url
                        if (evento.sql && evento.formato && evento.titulo) {
                            callbacks.onExportUrl(evento.sql, evento.formato, evento.titulo);
                        }
                        break;
                    case 'import_ready':
                        if (evento.mapeo && evento.destino) {
                            callbacks.onImportReady(
                                evento.mapeo,
                                evento.destino,
                                evento.tabla,
                                evento.endpoint
                            );
                        }
                        break;
                }
            } catch {
                // Ignorar lineas que no sean JSON valido
            }
        }
    }
}
