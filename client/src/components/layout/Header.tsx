import { LogOut, Trash2, Download } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { exportarPDF } from '@/lib/pdfExport';
import { type Mensaje } from '@/types';

interface HeaderProps {
    onLimpiarChat: () => void;
    mensajes: Mensaje[];
}

export function Header({ onLimpiarChat, mensajes }: HeaderProps) {
    const usuario = useAuthStore(s => s.usuario);
    const { logout } = useAuth();
    const hayMensajes = mensajes.filter(
        m => !m.cargando && !m.error && m.contenido.trim()
    ).length > 0;
    const handleExportar = () => {
        if (!hayMensajes) return;
        const ahora = new Date();
        const fecha = ahora.toISOString().slice(0, 10);
        const hora = ahora.toLocaleString('es-CO', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        })
            .replace(':', '-')   // reemplazar : por - (no valido en nombre de archivo)
            .replace('.', '');   // quitar punto si existe en "a.m."

        exportarPDF(mensajes, {
            titulo: 'Informe de Chat — Watto Agent',
            subtitulo: `Usuario: ${usuario?.nombre || 'Sistema'} · Rol: ${usuario?.rol || ''}`,
            nombreArchivo: `watto-chat-${fecha} ${hora}.pdf`,
        });
    };
    return (
        <header className="h-14 border-b border-(--border) bg-(--bg-card) flex items-center justify-between px-4">

            {/* Nombre del agente */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-(--bubble-user) flex items-center justify-center">
                    <span className="text-sm font-bold text-(--bubble-user-text)">W</span>
                </div>
                <span className="font-semibold text-(--text)">
                    {import.meta.env.VITE_AGENT_NAME || 'Watto'}
                </span>
            </div>

            {/* Controles a la derecha */}
            <div className="flex items-center gap-1">

                {/* Nombre del usuario y rol */}
                {usuario && (
                    <span className="text-sm text-(--text-muted) hidden sm:block mr-2">
                        {usuario.nombre}
                        {usuario.rol === 'admin' && (
                            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-(--bubble-user)/20 text-(--bubble-user)">
                                admin
                            </span>
                        )}
                    </span>
                )}

                {/* Exportar a PDF — solo visible cuando hay mensajes */}
                {hayMensajes && (
                    <button
                        onClick={handleExportar}
                        className="p-2 rounded-lg hover:bg-(--bg-surface) transition-colors group relative"
                        title="Exportar conversacion a PDF"
                    >
                        <Download size={16} className="text-(--text-muted) group-hover:text-(--text) transition-colors" />
                    </button>
                )}

                {/* Limpiar chat */}
                <button
                    onClick={onLimpiarChat}
                    className="p-2 rounded-lg hover:bg-(--bg-surface) transition-colors"
                    title="Limpiar conversacion"
                >
                    <Trash2 size={16} className="text-(--text-muted)" />
                </button>
                <ThemeToggle />

                {/* Cerrar sesion */}
                <button
                    onClick={logout}
                    className="p-2 rounded-lg hover:bg-(--bg-surface) transition-colors"
                    title="Cerrar sesion"
                >
                    <LogOut size={16} className="text-(--text-muted)" />
                </button>
            </div>
        </header>
    );
}