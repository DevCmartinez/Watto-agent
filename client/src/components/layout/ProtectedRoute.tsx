import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
interface Props { children: React.ReactNode; }

// Componente que redirige al login si no hay sesion activa
export function ProtectedRoute({ children }: Props) {
    const estaAutenticado = useAuthStore(s => s.estaAutenticado());
    if (!estaAutenticado) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}