import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { Send, StopCircle } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Header } from '@/components/layout/Header';
import { clsx } from 'clsx';

export function ChatPage() {
    const { mensajes, cargando, toolActivo, enviarMensaje, cancelar, limpiarChat } = useChat();
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes]);

    const handleSend = () => {
        if (!input.trim() || cargando) return;
        enviarMensaje(input.trim());
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = () => {
        if (!textareaRef.current) return;
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    };

    // Detectar si el ultimo mensaje del agente pide confirmacion
    const ultimoMensaje = mensajes[mensajes.length - 1];
    const mostrarConfirmacion = ultimoMensaje?.rol === 'assistant' &&
        !ultimoMensaje.cargando &&
        !cargando &&
        (ultimoMensaje.contenido.toLowerCase().includes('(si/no)') ||
            ultimoMensaje.contenido.toLowerCase().includes('¿confirmas') ||
            ultimoMensaje.contenido.toLowerCase().includes('confirmas esta'));

    return (
        <div className="flex flex-col h-screen bg-(--bg)">
            <Header onLimpiarChat={limpiarChat} mensajes={mensajes} />

            {/* Lista de mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-3xl mx-auto">
                    {mensajes.length === 0 && (
                        <div className="text-center mt-20">
                            <div className="w-16 h-16 rounded-2xl bg-(--bubble-user) flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl font-bold text-(--bubble-user-text)">W</span>
                            </div>
                            <h2 className="text-xl font-semibold text-(--text) mb-2">
                                Hola, soy {import.meta.env.VITE_AGENT_NAME || 'Watto'}
                            </h2>
                            <p className="text-(--text-muted) text-sm">
                                Puedo consultar y gestionar los datos de tu sistema.
                                <br />Escribe tu pregunta para comenzar.
                            </p>
                        </div>
                    )}

                    {mensajes.map(m => <MessageBubble key={m.id} mensaje={m} />)}

                    {toolActivo && (
                        <div className="flex gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-(--bg-surface) flex items-center justify-center text-xs font-bold">
                                W
                            </div>
                            <div className="px-4 py-2 rounded-2xl bg-(--bg-surface) text-(--text-muted) text-sm italic">
                                Consultando datos...
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Botones de confirmacion — aparecen automaticamente */}
            {mostrarConfirmacion && (
                <div className="border-t border-(--border) bg-(--bg-card) px-4 pt-3 pb-1">
                    <div className="max-w-3xl mx-auto flex gap-2 justify-end">
                        <button
                            onClick={() => enviarMensaje('no')}
                            className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                        >
                            No, cancelar
                        </button>
                        <button
                            onClick={() => enviarMensaje('si')}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                            Si, confirmar
                        </button>
                    </div>
                </div>
            )}

            {/* Input de texto */}
            <div className="border-t border-(--border) glass p-4 sticky bottom-0">

                <div className="max-w-3xl mx-auto">
                    <div className="flex gap-3 items-end">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onInput={handleInput}
                            placeholder={mostrarConfirmacion ? "Usa los botones de arriba para confirmar..." : "Escribe tu pregunta..."}
                            rows={1}
                            disabled={cargando || mostrarConfirmacion}
                            className={clsx(
                                'flex-1 resize-none rounded-xl border border-(--border) bg-(--input-bg)',
                                'text-(--text) placeholder:text-(--text-muted)',
                                'px-4 py-3 text-sm leading-relaxed',
                                'focus:outline-none focus:ring-2 focus:ring-(--bubble-user)',
                                'disabled:opacity-50 transition-colors'
                            )}
                        />
                        {cargando ? (
                            <button
                                onClick={cancelar}
                                className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            >
                                <StopCircle size={20} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || mostrarConfirmacion}
                                className="p-3 rounded-xl bg-(--bubble-user) text-(--bubble-user-text) disabled:opacity-40 hover:opacity-90 transition-opacity"
                            >
                                <Send size={20} />
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-(--text-muted) mt-2 text-center">
                        Enter para enviar · Shift+Enter para nueva linea
                    </p>
                </div>
            </div>
        </div>
    );
}