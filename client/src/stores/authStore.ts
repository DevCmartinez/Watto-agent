import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Tipos del usuario autenticado
interface Usuario {
    id: number;
    nombre: string;
    email: string;
    rol: 'admin' | 'usuario';
}
interface AuthStore {
    usuario: Usuario | null;
    token: string | null;
    // Acciones
    setAuth: (usuario: Usuario, token: string) => void;
    cerrarSesion: () => void;
    estaAutenticado: () => boolean;
}
export const useAuthStore = create<AuthStore>()(
    // persist guarda el estado en localStorage automaticamente
    // Cuando el usuario recarga la pagina, el token se restaura
    persist(
        (set, get) => ({
            usuario: null,
            token:
                null,
            setAuth: (usuario, token) => set({ usuario, token }),
            cerrarSesion: () => set({ usuario: null, token: null }),
            // Funcion derivada — verifica si hay sesion activa
            estaAutenticado: () => get().token !== null,
        }),
        {
            name: 'watto-auth', // Clave en localStorage
        }
    )
);