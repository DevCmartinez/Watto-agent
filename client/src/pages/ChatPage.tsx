/**
 * @origin [client/src/pages/ChatPage.tsx]
 * @calledBy Configurado en [App.tsx] como la ruta protegida principal `/`.
 * @description Interfaz de chat principal para interactuar con el Agente Watto. 
 * Gestiona la visualización de mensajes, estados de herramientas, confirmaciones dinámicas
 * y el área de entrada con auto-ajuste. Implementa diseño premium 'Glassmorphism'.
 */

import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { Send, StopCircle, Bot, Sparkles, ShieldCheck } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Header } from '@/components/layout/Header';
import { clsx } from 'clsx';

export function ChatPage() {
    // Extracción de lógica del hook useChat (client/src/hooks/useChat.ts)
    const { mensajes, cargando, toolActivo, enviarMensaje, cancelar, limpiarChat } = useChat();
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /**
     * Efecto para mantener el scroll siempre en el último mensaje.
     * Se dispara cada vez que el array de mensajes cambia.
     */
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes]);

    /**
     * Procesa el envío del mensaje actual al agente.
     */
    const handleSend = () => {
        if (!input.trim() || cargando) return;
        enviarMensaje(input.trim());
        setInput('');
        // Resetear altura del textarea tras enviar
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    /**
     * Manejador de teclado para permitir enviar con Enter (si no se presiona Shift).
     */
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    /**
     * Ajuste dinámico de la altura del textarea según el contenido.
     */
    const handleInput = () => {
        if (!textareaRef.current) return;
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    };

    /**
     * Lógica de detección de confirmaciones (¿si/no?).
     * El agente suele preguntar esto antes de ejecutar acciones críticas en la BD.
     */
    const ultimoMensaje = mensajes[mensajes.length - 1];
    const mostrarConfirmacion = ultimoMensaje?.rol === 'assistant' &&
        !ultimoMensaje.cargando &&
        !cargando &&
        (ultimoMensaje.contenido.toLowerCase().includes('(si/no)') ||
            ultimoMensaje.contenido.toLowerCase().includes('¿confirmas') ||
            ultimoMensaje.contenido.toLowerCase().includes('confirmas esta'));

    return (
        <div className="flex flex-col h-screen bg-gradient-premium overflow-hidden transition-all duration-500">
            {/* Cabecera persistente (client/src/components/layout/Header.tsx) */}
            <Header onLimpiarChat={limpiarChat} mensajes={mensajes} />

            {/* Area de scroll de Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    
                    {/* Pantalla de bienvenida (Solo si no hay historial) */}
                    {mensajes.length === 0 && (
                        <div className="text-center mt-24 animate-fade-in">
                            <div className="w-20 h-20 rounded-3xl bg-(--bubble-user) shadow-xl shadow-(--bubble-user)/20 flex items-center justify-center mx-auto mb-6 transform hover:rotate-6 transition-transform">
                                <Bot size={40} className="text-(--bubble-user-text)" />
                            </div>
                            <h2 className="text-3xl font-bold text-(--text) mb-3 tracking-tight">
                                Workspace Autónomo
                            </h2>
                            <p className="text-(--text-muted) text-md max-w-sm mx-auto leading-relaxed">
                                Bienvenido al centro de control empresarial. Puedo gestionar bases de datos, APIs y reportes avanzados por ti.
                                <br />
                                <span className="text-xs font-mono mt-6 block opacity-40 uppercase tracking-widest font-bold">Listando recursos del sistema...</span>
                            </p>
                        </div>
                    )}

                    {/* Lista dinámica de burbujas de mensaje */}
                    <div className="space-y-6">
                        {mensajes.map((m) => (
                            <div key={m.id} className="animate-fade-in">
                                <MessageBubble mensaje={m} />
                            </div>
                        ))}
                    </div>

                    {/* Indicador de Herramientas Activas (SQL, API, etc) */}
                    {toolActivo && (
                        <div className="flex gap-4 mb-4 mt-8 animate-pulse">
                            <div className="w-10 h-10 rounded-xl bg-(--bg-surface) border border-(--border)/50 flex items-center justify-center shadow-sm">
                                <Sparkles size={18} className="text-accent" />
                            </div>
                            <div className="px-5 py-3 rounded-2xl bg-(--bg-surface)/30 border border-(--border)/30 text-(--text-muted) text-sm font-semibold flex items-center gap-3 backdrop-blur-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                Estamos procesando su solicitud...
                            </div>
                        </div>
                    )}


                    <div ref={bottomRef} className="h-6" />
                </div>
            </div>

            {/* Panel de Confirmación Contextual - Diseño Glass */}
            {mostrarConfirmacion && (
                <div className="border-t border-(--border)/30 glass px-6 py-5 animate-fade-in z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <ShieldCheck size={18} className="text-green-500" />
                            </div>
                            <p className="text-sm font-bold text-(--text) tracking-tight">
                                El agente requiere su aprobación explícita para continuar.
                            </p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button
                                onClick={() => enviarMensaje('no')}
                                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-black hover:bg-red-500/10 transition-all uppercase tracking-widest"
                            >
                                Cancelar acción
                            </button>
                            <button
                                onClick={() => enviarMensaje('si')}
                                className="flex-1 sm:flex-none px-8 py-2.5 rounded-xl bg-green-600 text-white text-xs font-black shadow-lg shadow-green-600/30 hover:bg-green-700 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                            >
                                Confirmar y Ejecutar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Area de Entrada Premium */}
            <div className="border-t border-(--border)/20 glass p-6 sticky bottom-0 z-10">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-4 items-end bg-(--input-bg)/30 rounded-2xl p-2 border border-(--border)/50 focus-within:border-(--bubble-user)/60 focus-within:ring-4 focus-within:ring-(--bubble-user)/5 transition-all shadow-sm backdrop-blur-md">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onInput={handleInput}
                            placeholder={mostrarConfirmacion ? "Confirmación pendiente..." : "Solicite reporte, consulta SQL o análisis..."}
                            rows={1}
                            disabled={cargando || mostrarConfirmacion}
                            className={clsx(
                                'flex-1 resize-none bg-transparent',
                                'text-(--text) placeholder:text-(--text-muted)/50',
                                'px-5 py-3.5 text-sm font-medium leading-relaxed outline-none',
                                'disabled:opacity-40 transition-opacity'
                            )}
                        />
                        <div className="pb-1.5 pr-1.5">
                            {cargando ? (
                                <button
                                    onClick={cancelar}
                                    className="p-3.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all shadow-sm group"
                                    title="Interrumpir proceso"
                                >
                                    <StopCircle size={22} className="group-hover:scale-110 transition-transform" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || mostrarConfirmacion}
                                    className="p-3.5 rounded-xl bg-(--bubble-user) text-(--bubble-user-text) disabled:opacity-20 hover:shadow-xl hover:shadow-(--bubble-user)/40 hover:scale-105 active:scale-90 transition-all group"
                                    title="Enviar instrucción"
                                >
                                    <Send size={22} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Footer del chat */}
                    <div className="flex justify-between items-center px-4 mt-4">
                        <div className="flex items-center gap-2 opacity-30">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-[10px] text-(--text-muted) uppercase tracking-[0.2em] font-black">
                                Watto Unified Console
                            </p>
                        </div>
                        <p className="text-[10px] text-(--text-muted) font-bold opacity-50">
                            CMD + Enter para saltar línea
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}