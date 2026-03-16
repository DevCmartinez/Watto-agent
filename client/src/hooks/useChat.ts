import { useState, useRef, useCallback, useEffect } from 'react';
import { streamAgente, type MensajeHistorial } from '@/lib/stream';
import { type Mensaje } from '@/types';

const genId = () => Math.random().toString(36).slice(2);

export function useChat() {
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [cargando, setCargando] = useState(false);
    const [toolActivo, setToolActivo] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const mensajesRef = useRef<Mensaje[]>([]);

    // Mantener la ref sincronizada con el estado
    useEffect(() => {
        mensajesRef.current = mensajes;
    }, [mensajes]);

    const enviarMensaje = useCallback(async (texto: string) => {
        if (!texto.trim() || cargando) return;

        // Calcular historial en el momento de enviar desde la ref
        // No desde el estado (que puede estar desactualizado en el closure)
        const historialActual: MensajeHistorial[] = mensajesRef.current
            .filter(m => !m.error && !m.cargando && m.contenido.trim())
            .slice(-6)
            .map(m => ({ role: m.rol, content: m.contenido }));

        const msgUsuario: Mensaje = { id: genId(), rol: 'user', contenido: texto };
        setMensajes(prev => [...prev, msgUsuario]);

        const idAgente = genId();
        const msgAgente: Mensaje = { id: idAgente, rol: 'assistant', contenido: '', cargando: true };
        setMensajes(prev => [...prev, msgAgente]);

        setCargando(true);
        abortRef.current = new AbortController();

        await streamAgente(
            texto,
            historialActual,
            {
                onChunk: (chunk) => {
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
    }, [cargando]); // Solo depende de cargando, no del historial

    const cancelar = useCallback(() => {
        abortRef.current?.abort();
        setCargando(false);
        setToolActivo(null);
    }, []);

    const limpiarChat = useCallback(() => {
        setMensajes([]);
    }, []);

    return { mensajes, cargando, toolActivo, enviarMensaje, cancelar, limpiarChat };
}