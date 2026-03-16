import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variante?: 'primary' | 'ghost' | 'danger';
    tamano?:
    'sm' | 'md' | 'lg';
    cargando?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variante = 'primary', tamano = 'md', cargando, children, className, disabled, ...props },
        ref) => {

        const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration - 200 disabled: opacity - 50 disabled: cursor - not - allowed';

        const variantes = {
            primary: 'bg-[var(--bubble-user)] text-[var(--bubble-user-text)] hover:opacity-90',
            ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--bg-surface)] border border-[var(--border)]',
            danger: 'bg-red-600 text-white hover:bg-red-700',
        };
        const tamanos = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-sm',
            lg: 'px-6 py-3 text-base',
        };
        return (
            <button
                ref={ref}
                disabled={disabled || cargando}
                className={clsx(base, variantes[variante], tamanos[tamano], className)}
                {...props}
            >
                {cargando ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Cargando...
                    </span>
                ) : children}
            </button>
        );
    }
);
Button.displayName = 'Button';