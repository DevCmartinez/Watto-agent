import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeToggle() {
    const { tema, toggleTema } = useThemeStore();
    return (
        <button
            onClick={toggleTema}
            className="p-2 rounded-lg hover:bg-(--bg-surface) transition-colors"
            title={tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
            {tema === 'dark'
                ? <Sun size={18} className="text-(--text-muted)" />
                : <Moon size={18} className="text-(--text-muted)" />
            }
        </button>
    );
}