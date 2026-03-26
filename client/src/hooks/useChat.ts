import { useState, useRef, useCallback, useEffect } from 'react';
import { streamAgente, type MensajeHistorial } from '@/lib/stream';
import { type Mensaje } from '@/types';
import { descargarExportacion } from '@/lib/agentExportBridge';
import { formatearMuestraParaAgente } from '@/lib/fileReader';
import { type ArchivoImport } from '@/types';
import { procesarImportAgente } from '@/lib/agentImportBridge';


const genId = () => Math.random().toString(36).slice(2);

/**
 * @origin [client/src/hooks/useChat.ts]
 * @calledBy [ChatPage.tsx] para manejar la interfaz de conversación.
 * @description Hook que gestiona el estado del chat (mensajes, carga, tools activos),
 * realiza el streaming hacia el backend y descarga las exportaciones detectadas.
 */
export function useChat() {

    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [cargando, setCargando] = useState(false);
    const [toolActivo, setToolActivo] = useState<string | null>(null);
    const [archivoActual, setArchivoActual] = useState<ArchivoImport | null>(null);
    
    const abortRef = useRef<AbortController | null>(null);
    const mensajesRef = useRef<Mensaje[]>([]);
    const archivoActualRef = useRef<ArchivoImport | null>(null);

    // Mantener refs sincronizadas para evitar cierres (closures) obsoletos
    useEffect(() => {
        mensajesRef.current = mensajes;
    }, [mensajes]);

    useEffect(() => {
        archivoActualRef.current = archivoActual;
    }, [archivoActual]);

    // Función base para manejar el envío unificado
    const baseEnviar = useCallback(async (texto: string, archivoContexto?: ArchivoImport) => {
        if (!texto.trim() || cargando) return;

        // Si se provee un archivo nuevo, lo registramos como el actual
        if (archivoContexto) setArchivoActual(archivoContexto);
        const archivoParaMapeo = archivoContexto || archivoActualRef.current;

        // Preparar historial (máximo 8 mensajes para contexto sólido)
        const historialActual: MensajeHistorial[] = mensajesRef.current
            .filter(m => !m.error && !m.cargando && m.contenido.trim())
            .slice(-8)
            .map(m => ({ role: m.rol, content: m.contenido }));

        const idUsuario = genId();
        const msgUsuario: Mensaje = { id: idUsuario, rol: 'user', contenido: texto };
        
        const idAgente = genId();
        const msgAgente: Mensaje = { id: idAgente, rol: 'assistant', contenido: '', cargando: true };

        setMensajes(prev => [...prev, msgUsuario, msgAgente]);
        setCargando(true);
        setToolActivo(null);
        abortRef.current = new AbortController();

        // Enriquecer el prompt si hay contexto de archivo
        let promptFinal = texto;
        if (archivoParaMapeo) {
            const muestra = formatearMuestraParaAgente(archivoParaMapeo);
            promptFinal = `${texto}\n\n[Contexto del archivo cargado]\n${muestra}`;
        }

        try {
            await streamAgente(
                promptFinal,
                historialActual,
                {
                    onChunk: (chunk) => {
                        setMensajes(prev => prev.map(m =>
                            m.id === idAgente ? { ...m, contenido: m.contenido + chunk, cargando: false } : m
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
                            m.id === idAgente ? { ...m, contenido: mensaje, cargando: false, error: true } : m
                        ));
                        setCargando(false);
                        setToolActivo(null);
                    },

                    onExportUrl: (url, formato, titulo) => {
                        descargarExportacion(url, formato, titulo);
                    },

                    onImportReady: (mapeo, destino, tabla, endpoint) => {
                        // Usar el archivo presente en esta ejecución
                        if (archivoParaMapeo) {
                            procesarImportAgente(mapeo, destino, archivoParaMapeo, tabla, endpoint);
                        }
                    },
                },
                abortRef.current.signal
            );
        } catch (e: any) {
            // Manejar cancelación explícita
            if (e.name === 'AbortError') {
                setMensajes(prev => prev.map(m =>
                    m.id === idAgente ? { ...m, cargando: false, contenido: m.contenido + ' [Cancelado]' } : m
                ));
            }
            setCargando(false);
            setToolActivo(null);
        } finally {
            abortRef.current = null;
        }
    }, [cargando]); // Solo depende de cargando para bloquear envíos paralelos

    const enviarMensaje = useCallback((texto: string) => baseEnviar(texto), [baseEnviar]);
    const enviarMensajeConArchivo = useCallback((texto: string, archivo: ArchivoImport) => baseEnviar(texto, archivo), [baseEnviar]);

    const cancelar = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            // El catch del flujo baseEnviar se encargará del estado
        }
    }, []);

    const limpiarChat = useCallback(() => {
        setMensajes([]);
        setArchivoActual(null);
    }, []);

    return { 
        mensajes, 
        cargando, 
        toolActivo, 
        archivoActual,
        enviarMensaje, 
        cancelar, 
        limpiarChat, 
        enviarMensajeConArchivo 
    };
}