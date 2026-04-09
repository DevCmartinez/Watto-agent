import { lazy, Suspense } from 'react';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/authStore';
import { type Mensaje } from '@/types';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

// Lazy-load de ReactMarkdown (solo se carga cuando se necesita renderizar markdown del agente)
const ReactMarkdown = lazy(() => import('react-markdown'));

interface Props { mensaje: Mensaje; }
export function MessageBubble({ mensaje }: Props) {
    const esUsuario = mensaje.rol === 'user';
    const usuario = useAuthStore((state) => state.usuario);
    return (
        <div className={clsx('flex gap-2.5 mb-6 items-start', esUsuario && 'flex-row-reverse')}>
            {/* Cápsula de Identidad (Avatar + Nombre) */}
            <div className={clsx(
                'h-8 p-1 rounded-full flex items-center gap-2 shrink-0 border shadow-sm transition-all duration-300',
                'bg-(--bg-surface) border-(--border)',
                esUsuario ? 'flex-row-reverse' : 'flex-row'
            )}>
                {/* Círculo con Inicial */}
                <div className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm',
                    esUsuario 
                        ? 'bg-(--bubble-user) text-(--bubble-user-text)' 
                        : 'bg-primary text-white'
                )}>
                    {esUsuario ? (usuario?.nombre?.charAt(0) || 'Tú') : 'W'}
                </div>
                {/* Nombre - Usando variable reactiva --text para visibilidad garantizada */}
                <span className={clsx(
                    'text-[10px] font-bold px-1 whitespace-nowrap transition-colors duration-300',
                    'text-(--text)'
                )}>
                    {esUsuario ? (usuario?.nombre || 'Tú') : 'Watto AI'}
                </span>
            </div>

            {/* Burbuja */}
            <div className={clsx(
                'px-4 py-3 rounded-2xl text-sm leading-relaxed bubble-shadow max-w-[70%]',
                esUsuario
                    ? 'bg-(--bubble-user) text-(--bubble-user-text) rounded-tr-sm bubble-user-glow'
                    : 'bg-(--bubble-bot) text-(--bubble-bot-text) rounded-tl-sm bubble-bot-glow',
                mensaje.error && 'border border-red-500/30 bg-red-500/10 text-red-400'
            )}>

                {/* Indicador de carga — tres puntos animados */}
                {mensaje.cargando ? (
                    <span className="flex gap-1 items-center py-1">
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
                    </span>
                ) : esUsuario ? (
                    <p className="whitespace-pre-wrap">{mensaje.contenido}</p>
                ) : (
                    <div className="markdown-content">
                        <Suspense fallback={<span className="text-xs opacity-50">Cargando...</span>}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {DOMPurify.sanitize(mensaje.contenido)}
                            </ReactMarkdown>
                        </Suspense>
                    </div>
                )}
                {/* Tokens usados — solo en mensajes del agente */}
                {mensaje.tokens && !esUsuario && (
                    <p className="text-xs opacity-40 mt-2 text-right">
                        {mensaje.tokens} tokens
                    </p>
                )}
            </div>
        </div>
    );
}

// Tipos para componentes markdown
type MarkdownProps = { children?: ReactNode };

// Componentes personalizados para cada elemento markdown
// Aplican estilos que respetan las variables CSS del tema
const markdownComponents = {
    // Tablas — con scroll horizontal para tablas anchas
    table: ({ children }: MarkdownProps) => (
        <div className="overflow-x-auto my-3 rounded-lg border border-(--border)">
            <table className="text-xs border-collapse">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }: MarkdownProps) => (
        <thead className="bg-(--bg-surface)">{children}</thead>
    ),
    th: ({ children }: MarkdownProps) => (
        <th className="px-3 py-2 text-left font-semibold border-b border-(--border)
                        text-(--text) whitespace-nowrap">
            {children}
        </th>
    ),
    td: ({ children }: MarkdownProps) => (
        <td className="px-3 py-2 border-b border-(--border)/50 text-(--text) whitespace-nowrap">
            {children}
        </td>
    ),
    tr: ({ children }: MarkdownProps) => (
        <tr className="even:bg-(--bg-surface)/50 hover:bg-(--bg-surface) transition-colors">
            {children}
        </tr>
    ),
    // Codigo inline — fondo con color
    code: ({ inline, children, className }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
        if (inline) {
            return (
                <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-(--bg-surface) text-(--text) border border-(--border)">
                    {children}
                </code>
            );
        }
        // Bloque de codigo (```sql ... ```)
        return (
            <div className="my-3 rounded-lg overflow-hidden border border-(--border)">
                {/* Header del bloque con el lenguaje */}
                {className && (
                    <div className="px-3 py-1 text-xs font-mono bg-(--bg-surface) text-(--text-muted) border-b border-(--border)">
                        {className.replace('language-', '')}
                    </div>
                )}
                <pre className="p-3 overflow-x-auto bg-(--input-bg)">
                    <code className="text-xs font-mono text-(--text)">{children}</code>
                </pre>
            </div>
        );
    },
    // Parrafos — espacio entre ellos
    p: ({ children }: MarkdownProps) => (
        <p className="mb-2 last:mb-0">{children}</p>
    ),
    // Listas con puntos
    ul: ({ children }: MarkdownProps) => (
        <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
    ),
    // Listas numeradas
    ol: ({ children }: MarkdownProps) => (
        <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
    ),
    // Items de lista
    li: ({ children }: MarkdownProps) => (
        <li className="text-sm">{children}</li>
    ),
    // Negrita
    strong: ({ children }: MarkdownProps) => (
        <strong className="font-semibold">{children}</strong>
    ),
    // Cursiva
    em: ({ children }: MarkdownProps) => (
        <em className="italic opacity-90">{children}</em>
    ),
    // Encabezados dentro del chat
    h1: ({ children }: MarkdownProps) => (
        <h1 className="text-base font-bold mb-2 mt-3">{children}</h1>
    ),
    h2: ({ children }: MarkdownProps) => (
        <h2 className="text-sm font-bold mb-2 mt-3">{children}</h2>
    ),
    h3: ({ children }: MarkdownProps) => (
        <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>
    ),
    // Separador horizontal
    hr: () => (
        <hr className="my-3 border-t border-(--border)" />
    ),
    // Links — seguridad extra: sanitizar href y asegurar no externally
    a: ({ href, children }: ComponentPropsWithoutRef<'a'>) => {
        // Sanitizar href para prevenir javascript: y data: URIs
        const safeHref = href ? DOMPurify.sanitize(href, { ALLOWED_URI_REGEXP: /^(https?:)/ }) : '#';
        return (
            <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline opacity-80 hover:opacity-100 transition-opacity"
            >
                {children}
            </a>
        );
    },
    // Blockquote
    blockquote: ({ children }: MarkdownProps) => (
        <blockquote className="border-l-2 border-(--border) pl-3 my-2 italic opacity-80">
            {children}
        </blockquote>
    ),
};