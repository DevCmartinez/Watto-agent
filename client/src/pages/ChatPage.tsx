/**
 * @origin [client/src/pages/ChatPage.tsx]
 * @calledBy Configurado en [App.tsx] como la ruta protegida principal `/`.
 * @description Interfaz de chat principal para interactuar con el Agente Watto. 
 * Gestiona la visualización de mensajes, estados de herramientas, confirmaciones dinámicas
 * y el área de entrada con auto-ajuste. Implementa diseño premium 'Glassmorphism'.
 */

import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { Send, StopCircle, Bot, Sparkles, ShieldCheck, Upload } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Header } from '@/components/layout/Header';
import { leerArchivo } from '@/lib/fileReader';
import { clsx } from 'clsx';

export function ChatPage() {
    // Extracción de lógica del hook useChat (client/src/hooks/useChat.ts)
    const { mensajes, cargando, toolActivo, enviarMensaje, cancelar, limpiarChat, enviarMensajeConArchivo } = useChat();
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Ref para el input file oculto
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Manejar la seleccion de un archivo por el usuario
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar que sea Excel o CSV
        const esValido = file.name.endsWith('.xlsx') ||
            file.name.endsWith('.xls') ||
            file.name.endsWith('.csv');
        if (!esValido) {
            alert('Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)');
            return;
        }

        // Validar tamano maximo: 10MB
        if (file.size > 10 * 1024 * 1024) {
            alert('El archivo no puede superar 10MB');
            return;

        } try {
            // Leer el archivo con SheetJS
            const archivo = await leerArchivo(file);
            enviarMensajeConArchivo;

            // Mostrar mensaje en el chat indicando que el archivo fue cargado
            // El usuario debera escribir que quiere hacer con el archivo
            const mensajeCarga = [
                `■ Archivo cargado: **${archivo.nombre}**`,
                `${archivo.totalFilas} filas · ${archivo.encabezados.length} columnas`,
                `Columnas detectadas: ${archivo.encabezados.join(', ')}`,
                ``,
                `Escribe que deseas hacer con este archivo.`,
                `Ejemplo: "importa estos datos como nuevos clientes"`,
            ].join('');

            // Enviar el mensaje de carga al chat (sin pasar por el agente todavia)
            enviarMensajeConArchivo(mensajeCarga, archivo);
        } catch (err: any) {
            alert('Error al leer el archivo: ' + err.message);
        }
        // Limpiar el input para permitir subir el mismo archivo de nuevo
        e.target.value = '';
    };


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
        <div className="flex flex-col h-screen bg-gradient-premium overflow-hidden transition-all duration-500 relative">

            {/* Orbes de Fondo Dinámicos */}
            <div className="orb w-80 h-80 bg-primary/10 top-[-10%] right-[-10%] opacity-40" />
            <div className="orb w-64 h-64 bg-accent/5 bottom-[10%] left-[-5%] opacity-30 [animation-delay:-7s]" />

            {/* Cabecera persistente (client/src/components/layout/Header.tsx) */}
            <Header onLimpiarChat={limpiarChat} mensajes={mensajes} />

            {/* Area de scroll de Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar relative z-10">
                <div className="max-w-4xl mx-auto">

                    {/* Pantalla de bienvenida (Solo si no hay historial) */}
                    {mensajes.length === 0 && (
                        <div className="text-center mt-24 animate-fade-in">
                            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-[32px] bg-primary shadow-2xl shadow-primary/30 mb-8 group transition-all hover:rotate-3">
                                <div className="absolute inset-0 rounded-[32px] bg-linear-to-tr from-accent/30 to-transparent animate-pulse" />
                                <Bot size={48} className="text-white relative z-10" />
                            </div>
                            <h2 className="text-4xl font-black text-(--text) mb-4 tracking-tighter">
                                Operation Center
                            </h2>
                            <p className="text-(--text-muted) text-sm max-w-sm mx-auto leading-relaxed border-l-2 border-accent/20 pl-6 italic">
                                Sistema de inteligencia autónoma integral para el análisis de datos masivos y gestión.
                            </p>
                            <div className="mt-12 flex justify-center gap-3 opacity-30">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0s' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    )}

                    {/* Lista dinámica de burbujas de mensaje */}
                    <div className="space-y-8">
                        {mensajes.map((m) => (
                            <div key={m.id} className="animate-fade-in">
                                <MessageBubble mensaje={m} />
                            </div>
                        ))}
                    </div>

                    {/* Indicador de Herramientas Activas (SQL, API, etc) */}
                    {toolActivo && (
                        <div className="flex gap-4 mb-4 mt-8 animate-pulse">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-accent/20 flex items-center justify-center shadow-lg backdrop-blur-md">
                                <Sparkles size={18} className="text-accent" />
                            </div>
                            <div className="px-6 py-3 rounded-2xl glass border border-white/10 text-(--text-muted) text-[10px] font-black uppercase tracking-widest flex items-center gap-4">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                                </span>
                                Procesando flujo de datos...
                            </div>
                        </div>
                    )}

                    <div ref={bottomRef} className="h-6" />
                </div>
            </div>

            {/* Panel de Confirmación Contextual - Diseño Glass */}
            {mostrarConfirmacion && (
                <div className="border-t border-white/10 glass px-6 py-6 animate-fade-in z-20 shadow-2xl">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-green-500/20 flex items-center justify-center shadow-inner">
                                <ShieldCheck size={20} className="text-green-500" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-(--text) uppercase tracking-wider">
                                    Gatekeeper Authorization
                                </p>
                                <p className="text-[10px] text-(--text-muted) font-bold">
                                    Se requiere su firma digital para proceder.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button
                                onClick={() => enviarMensaje('no')}
                                className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-[10px] font-black hover:bg-red-500/20 transition-all uppercase tracking-widest"
                            >
                                Rehusar
                            </button>
                            <button
                                onClick={() => enviarMensaje('si')}
                                className="flex-1 sm:flex-none px-10 py-3 rounded-xl bg-primary text-white text-[10px] font-black shadow-xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest border border-white/10"
                            >
                                Autorizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Area de Entrada Premium */}
            <div className="p-6 sticky bottom-0 z-30">
                <div className="max-w-4xl mx-auto">
                    <div className="glass rounded-[32px] p-2 border border-white/20 shadow-2xl transition-all">

                        <div className="flex gap-4 items-center bg-white/5 rounded-[24px]">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onInput={handleInput}
                                placeholder={mostrarConfirmacion ? "Confirmación pendiente..." : "Escribe aquí... ( Shift + Enter para saltar línea )"}
                                rows={1}
                                disabled={cargando || mostrarConfirmacion}
                                className={clsx(
                                    'flex-1 resize-none bg-transparent',
                                    'text-(--text) placeholder:text-(--text-muted)/40',
                                    'px-6 py-4.5 text-sm font-medium leading-relaxed outline-none',
                                    'disabled:opacity-40 transition-opacity'
                                )}
                            />
                            <div className="flex items-center gap-2 pr-2">
                                {/* // Input file oculto — se activa desde el boton de upload */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                {/* Boton de importacion — Ajustado para ser simétrico con el de enviar */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={cargando}
                                    className="aspect-square p-4 rounded-2xl border border-white/10 bg-white/5 text-(--text-muted) hover:text-(--text) hover:bg-white/10 disabled:opacity-40 transition-all flex items-center justify-center shadow-lg"
                                    title="Importar Excel o CSV"
                                >
                                    <Upload size={20} />
                                </button>

                                {cargando ? (
                                    <button
                                        onClick={cancelar}
                                        className="aspect-square p-4 rounded-2xl bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-all shadow-lg backdrop-blur-xl flex items-center justify-center"
                                    >
                                        <StopCircle size={20} className="animate-spin-slow" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || mostrarConfirmacion}
                                        className="aspect-square p-4 rounded-2xl bg-primary text-white disabled:opacity-20 hover:shadow-2xl hover:shadow-primary/50 hover:scale-105 active:scale-90 transition-all group flex items-center justify-center shadow-lg"
                                    >
                                        <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer del chat */}
                    <div className="flex justify-between items-center px-6 mt-4 opacity-40">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            <p className="text-[9px] text-(--text-muted) uppercase tracking-[0.3em] font-black">
                                WATTO SECURE LINK ACTIVE
                            </p>
                        </div>
                        <p className="text-[9px] text-(--text-muted) font-black">
                            V 0.0.39-ALPHA
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}