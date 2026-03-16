import { useAuthStore } from '@/stores/authStore';

// URL base del backend
// En desarrollo Vite hace proxy de /api al backend en :3000
// En produccion todo corre en el mismo servidor, /api funciona directo
const BASE_URL = '/api';

// Tipo de error de la API
export class ApiError extends Error {
    public status: number;
    public mensaje: string;
    public data?: any;

    constructor(
        status: number,
        mensaje: string,
        data?: any
    ) {
        super(mensaje);
        this.status = status;
        this.mensaje = mensaje;
        this.data = data;
        this.name = 'ApiError';
    }
}
// Funcion base para todas las peticiones
async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    // Leer el token del store de Zustand
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    // Agregar JWT si existe
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });
    // Si la respuesta es 401, cerrar sesion automaticamente
    if (response.status === 401) {
        useAuthStore.getState().cerrarSesion();
        window.location.href = '/login';
        throw new ApiError(401, 'Sesion expirada. Por favor inicia sesion de nuevo.');
    }
    const data = await response.json();
    if (!response.ok) {
        throw new ApiError(response.status, data.mensaje || 'Error del servidor', data);
    }
    return data;
}
// ■■ Metodos HTTP convenientes ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
export const api = {
    get:
        <T>(url: string) => request<T>(url),
    post:
        <T>(url: string, body: any) => request<T>(url, {
            method: 'POST', body: JSON.stringify(body)
        }),
    put:
        <T>(url: string, body: any) => request<T>(url, {
            method: 'PUT', body: JSON.stringify(body)
        }),
    delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};
// ■■ Tipos de respuesta del backend ■■■■■■■■■■■■■■■■■■■■■■■
export interface LoginResponse {
    exitoso: boolean;
    data: {
        usuario: { id: number; nombre: string; email: string; rol: 'admin' | 'usuario' };
        token: string;
    };
}
export interface AgentResponse {
    exitoso: boolean;
    data: {
        respuesta: string;
        tokens: number;
        tiempo_ms: number;
        modelo: string;
    };
}