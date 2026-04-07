import { useToastStore } from '@/stores/toastStore';

/**
 * SEC-04: El SQL ya no viaja en la URL como query string (GET).
 * Ahora se hace un POST a /api/export con el SQL en el body (encriptado en tránsito).
 * @param sql    La consulta SQL generada por el agente
 * @param formato xlsx | csv | pdf
 * @param titulo  Nombre del archivo a descargar
 */
export async function descargarExportacion(
    sql: string,
    formato: string,
    titulo: string
): Promise<void> {
    const { mostrarToast } = useToastStore.getState();

    const nombreArchivo = `${titulo}.${formato}`;
    try {
        // SEC-04: POST con el SQL en el body — ya no queda expuesto en la URL
        // SEC-01: Cookie HttpOnly se envia automáticamente
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, formato, titulo }),
        });

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

        mostrarToast(`Descargado: ${nombreArchivo}`);
    } catch (e: any) {
        mostrarToast('Error al descargar el archivo: ' + e.message, 'error');
    }
}
