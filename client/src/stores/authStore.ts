import { create } from 'zustand';

// Tipos del usuario autenticado
interface Usuario {
    id: number;
    nombre: string;
    email: string;
    rol: 'admin' | 'usuario';
}

interface AuthStore {
    usuario: Usuario | null;
    // Acciones
    setAuth: (usuario: Usuario) => void;
    cerrarSesion: () => void;
    estaAutenticado: () => boolean;
}

/**
 * SEC-01: Store de autenticación sin persistencia en localStorage.
 * El token JWT ahora se almacena en cookie HttpOnly (más seguro contra XSS).
 * Los datos del usuario se guardan solo en memoria (se pierden al recargar).
 * Al recargar, se puede llamar a /api/auth/perfil para recuperar sesión.
 */
export const useAuthStore = create<AuthStore>()((set, get) => ({
    usuario: null,
    setAuth: (usuario) => set({ usuario }),
    cerrarSesion: () => set({ usuario: null }),
    estaAutenticado: () => get().usuario !== null,
}));
