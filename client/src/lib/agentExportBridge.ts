import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';


// Descarga un archivo desde la URL del endpoint de exportacion
// El backend ya genero el archivo — el frontend solo lo descarga
export async function descargarExportacion(
    url: string,
    formato: string,
    titulo: string
): Promise<void> {
    const { mostrarToast } = useToastStore.getState();
    const token = useAuthStore.getState().token;

    // Nombre limpio del archivo
    const nombreArchivo = `${titulo}.${formato}`;
    try {

        // Hacer fetch al endpoint con el JWT en el header
        // El backend ejecuta el SQL y devuelve el archivo binario
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, },
        });
        // Verificar que la respuesta fue exitosa
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            mostrarToast(error.mensaje || 'Error al generar el archivo', 'error');
            return;
        }
        // Convertir la respuesta a blob (archivo binario)
        const blob = await response.blob();
        // Crear un link temporal y hacer click para descargar
        const urlBlob = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = urlBlob;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Limpiar la URL temporal de memoria
        URL.revokeObjectURL(urlBlob);
        // Mostrar notificacion de exito
        mostrarToast(`Descargado: ${nombreArchivo}`);
    } catch (e: any) {
        mostrarToast('Error al descargar el archivo: ' + e.message, 'error');
    }
}