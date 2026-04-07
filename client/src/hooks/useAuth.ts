import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'usuario';
}

interface ApiResponse<T> {
  exitoso: boolean;
  data: T;
  mensaje?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export function useAuth() {
  const { usuario, setAuth, cerrarSesion, estaAutenticado } = useAuthStore();
  const navigate = useNavigate();

  // Mutación de login con React Query
  const loginMutation = useMutation<ApiResponse<{ usuario: Usuario }>, Error, LoginData>({
    mutationFn: (datos) => api.post<ApiResponse<{ usuario: Usuario }>>('/auth/login', datos),
    onSuccess: (response) => {
      setAuth(response.data.usuario);
      navigate('/');
    },
  });

  // Mutación para recuperar sesión desde cookie (al recargar página)
  const recuperarSesionMutation = useMutation<ApiResponse<{ usuario: Usuario }>, Error, void>({
    mutationFn: () => api.get<ApiResponse<{ usuario: Usuario }>>('/auth/perfil'),
    onSuccess: (response) => {
      setAuth(response.data.usuario);
    },
    onError: () => {
      // Si falla (no hay cookie válida), asegurarse de que no hay sesión
      cerrarSesion();
    },
  });

  // Cerrar sesión y redirigir al login
  const logout = async () => {
    try {
      // Enviar POST con cuerpo vacío para que el servidor borre la cookie
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error('[Logout] Error:', error);
    } finally {
      cerrarSesion();
      navigate('/login');
    }
  };

  return {
    usuario,
    estaAutenticado: estaAutenticado(),
    login: loginMutation.mutate,
    loginCargando: loginMutation.isPending,
    loginError: loginMutation.error?.message,
    logout,
    recuperarSesion: recuperarSesionMutation.mutate,
    recuperandoSesion: recuperarSesionMutation.isPending,
  };
}
