import { clsx } from 'clsx';
import { type Mensaje } from '@/types';

interface Props { mensaje: Mensaje; }

export function MessageBubble({ mensaje }: Props) {
    const esUsuario = mensaje.rol === 'user';
    return (
        <div className={clsx('flex gap-3 mb-4', esUsuario && 'flex-row-reverse')}>
            {/* Avatar */}
            <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                esUsuario
                    ? 'bg-(--bubble-user) text-(--bubble-user-text)'
                    : 'bg-(--bg-surface) text-(--text)'
            )}>
                {esUsuario ? 'Tu' : 'W'}
            </div>

            {/* Burbuja */}
            <div className={clsx(
                'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                esUsuario
                    ? 'bg-(--bubble-user) text-(--bubble-user-text) rounded-tr-sm'
                    : 'bg-(--bubble-bot) text-(--bubble-bot-text) rounded-tl-sm',
                mensaje.error && 'border border-red-500/30 bg-red-500/10 text-red-500'
            )}>

                {/* Indicador de carga */}
                {mensaje.cargando ? (
                    <span className="flex gap-1 items-center py-1">
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
                    </span>
                ) : (
                    // Renderizar preservando saltos de linea y formato de tabla
                    <pre className="whitespace-pre-wrap font-sans">{mensaje.contenido}</pre>
                )}

                {/* Tokens usados */}
                {mensaje.tokens && (
                    <p className="text-xs opacity-50 mt-2">{mensaje.tokens} tokens</p>
                )}
            </div>
        </div>
    );
}