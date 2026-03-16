// Usuario autenticado
export interface Usuario {
    id: number;
    nombre: string;
    email: string;
    rol: 'admin' | 'usuario';
}
// Mensaje en el chat
export interface Mensaje {
    id: string;// UUID local para React key
    rol: 'user' | 'assistant';
    contenido: string;
    tokens?: number;// Solo en mensajes del agente
    cargando?: boolean;// true mientras el agente escribe
    error?: boolean;// true si hubo un error
}
// Estado del agente
export interface EstadoAgente {
    listo: boolean;
    modo: 'db' | 'api' | 'both';
    nombre: string;
    promptLength: number;
}