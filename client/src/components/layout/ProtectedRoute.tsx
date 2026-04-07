import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';

interface Props { children: React.ReactNode; }

// Componente que redirige al login si no hay sesión activa
// Si hay cookie HttpOnly, intenta recuperar el usuario desde /api/auth/perfil
export function ProtectedRoute({ children }: Props) {
    const { usuario, recuperarSesion, recuperandoSesion } = useAuth();
    const estaAutenticado = useAuthStore(s => s.estaAutenticado());

    useEffect(() => {
        // Si no hay usuario en el store, intentar recuperar desde servidor (cookie)
        if (!usuario && !recuperandoSesion) {
            recuperarSesion();
        }
    }, [usuario, recuperandoSesion, recuperarSesion]);

    // Estado de carga mientras se verifica sesión
    if (recuperandoSesion) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    // Si no hay sesión después del intento, redirigir
    if (!estaAutenticado) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}