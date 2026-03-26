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
// Opciones para la exportacion a PDF
export interface PdfOptions {
    titulo: string; // Titulo del documento en el encabezado
    subtitulo: string; // Subtitulo — ej: nombre del usuario o fecha
    nombreArchivo: string; // Nombre del archivo descargado
}

// Archivo leido por el frontend antes de enviarlo al agente
export interface ArchivoImport {
    nombre: string; // Nombre original del archivo (ej: clientes.xlsx)
    extension: 'xlsx' | 'csv';
    totalFilas: number;// Total de filas en el archivo (sin encabezados)
    encabezados: string[];// Primera fila: nombres de columnas del archivo
    muestra: string[][];// Primeras 5 filas de datos para el agente
    datosCompletos: any[]; // Todos los objetos fila para la importacion final


}
// Mapeo que genera el agente: columna del archivo -> campo del destino
export interface MapeoColumnas {
    [columnaArchivo: string]: string; // Ej: { "Nombre Completo": "nombre" }
}
// Resultado de la importacion en el backend
export interface ResultadoImport {
    insertados: number;
    errores: number;
    detalles: string[]; // Mensajes de error por fila si los hay
}