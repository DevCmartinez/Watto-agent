import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api, type LoginResponse } from '@/lib/api';

interface LoginData {
    email: string;
    password: string;
}
export function useAuth() {
    const { usuario, token, setAuth, cerrarSesion, estaAutenticado } = useAuthStore();
    const navigate = useNavigate();
    // Mutacion de login con React Query
    const loginMutation = useMutation({
        mutationFn: (datos: LoginData) =>
            api.post<LoginResponse>('/auth/login', datos),
        onSuccess: (response) => {
            const { usuario, token } = response.data;
            setAuth(usuario, token); // Guardar en Zustand + localStorage
            navigate('/');// Redirigir al chat
        },
    });
    // Cerrar sesion y redirigir al login
    const logout = () => {
        cerrarSesion();
        navigate('/login');
    };
    return {
        usuario,
        token,
        estaAutenticado: estaAutenticado(),
        login: loginMutation.mutate,
        loginCargando: loginMutation.isPending,
        loginError: loginMutation.error?.message,
        logout,
    };
}