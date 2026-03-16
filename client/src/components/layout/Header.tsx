import { LogOut, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
    onLimpiarChat: () => void;
}

export function Header({ onLimpiarChat }: HeaderProps) {
    const usuario = useAuthStore(s => s.usuario);
    const { logout } = useAuth();
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
            <div className="flex items-center gap-2">

                {/* Nombre del usuario */}
                {usuario && (
                    <span className="text-sm text-(--text-muted) hidden sm:block">
                        {usuario.nombre}
                        {usuario.rol === 'admin' && (<span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-(--bubble-user)/20 text-(--bubble-user)">
                            admin
                        </span>
                        )}
                    </span>
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