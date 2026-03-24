import { useEffect } from 'react';
import { X, FileDown } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { clsx } from 'clsx';

export function Toast() {
    const { visible, mensaje, tipo, ocultarToast } = useToastStore();

    // Ocultar automaticamente despues de 3.0 segundos
    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(ocultarToast, 3000);
        return () => clearTimeout(timer);
    }, [visible, ocultarToast]);
    if (!visible) return null;
    return (
        <div className={clsx(
            'fixed bottom-6 right-6 z-50',
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg',
            'border border-(--border) bg-(--bg-card)',
            'animate-in slide-in-from-bottom-2 duration-300',
            'max-w-sm'
        )}>
            {/* Icono segun el tipo */}
            {tipo === 'exito' && (
                <FileDown size={18} className="text-green-500 shrink-0" />
            )}
            {tipo === 'error' && (
                <span className="text-red-500 shrink-0">✗</span>
            )}

            {/* Mensaje */}
            <p className="text-sm text-(--text) flex-1">{mensaje}</p>

            {/* Boton cerrar */}
            <button
                onClick={ocultarToast}
                className="p-1 rounded hover:bg-(--bg-surface) transition-colors"
            >
                <X size={14} className="text-(--text-muted)" />
            </button>
        </div>
    );
}