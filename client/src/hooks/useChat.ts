import { useState, useRef, useCallback } from 'react';
import { streamAgente, type MensajeHistorial } from '@/lib/stream';
import { type Mensaje } from '@/types';

// Generar ID unico para cada mensaje
const genId = () => Math.random().toString(36).slice(2);

export function useChat() {
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [cargando, setCargando] = useState(false);
    const [toolActivo, setToolActivo] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Convertir mensajes del chat al formato del historial del agente
    const historial: MensajeHistorial[] = mensajes
        .filter(m => !m.error && !m.cargando && m.contenido.trim())
        .slice(-6) // Solo los ultimos 6 para no sobrepasar tokens
        .map(m => ({ role: m.rol, content: m.contenido }));
    const enviarMensaje = useCallback(async (texto: string) => {
        if (!texto.trim() || cargando) return;

        // Agregar mensaje del usuario
        const msgUsuario: Mensaje = { id: genId(), rol: 'user', contenido: texto };
        setMensajes(prev => [...prev, msgUsuario]);

        // Agregar mensaje placeholder del agente (mostrara el spinner)
        const idAgente = genId();
        const msgAgente: Mensaje = { id: idAgente, rol: 'assistant', contenido: '', cargando: true };
        setMensajes(prev => [...prev, msgAgente]);

        setCargando(true);
        abortRef.current = new AbortController();

        await streamAgente(
            texto,
            historial,
            {
                onChunk: (chunk) => {
                    // Acumular chunks en el mensaje del agente
                    setMensajes(prev => prev.map(m =>
                        m.id === idAgente
                            ? { ...m, contenido: m.contenido + chunk, cargando: false }
                            : m
                    ));
                    setToolActivo(null);
                },
                onTool: (nombre) => {
                    setToolActivo(nombre);
                },
                onFin: (tokens) => {
                    setMensajes(prev => prev.map(m =>
                        m.id === idAgente ? { ...m, tokens, cargando: false } : m
                    ));
                    setCargando(false);
                    setToolActivo(null);
                },
                onError: (mensaje) => {
                    setMensajes(prev => prev.map(m =>
                        m.id === idAgente
                            ? { ...m, contenido: mensaje, cargando: false, error: true }
                            : m
                    ));
                    setCargando(false);
                    setToolActivo(null);
                },
            },
            abortRef.current.signal
        );
    }, [cargando, historial]);

    // Cancelar el stream en curso
    const cancelar = useCallback(() => {
        abortRef.current?.abort();
        setCargando(false);
        setToolActivo(null);
    }, []);

    // Limpiar el historial del chat
    const limpiarChat = useCallback(() => {
        setMensajes([]);
    }, []);
    return { mensajes, cargando, toolActivo, enviarMensaje, cancelar, limpiarChat };