import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { type ArchivoImport } from '@/types';

// Procesar la importacion cuando el agente genera el mapeo
// Esta funcion se llama desde useChat cuando llega el evento import_ready
export async function procesarImportAgente(
    mapeo: Record<string, string>,// { columna_archivo: campo_bd }
    destino: 'bd' | 'api',// A donde importar
    archivo: ArchivoImport,// El archivo completo con todos los datos
    tabla?: string,// Nombre de la tabla (si destino=bd)
    endpoint?: string// Ruta del endpoint (si destino=api)
): Promise<void> {

    const { mostrarToast } = useToastStore.getState();
    const token = useAuthStore.getState().token;

    try {
        // Mostrar toast de inicio
        mostrarToast(
            `Importando ${archivo.totalFilas} registros...`,
            'info'
        );

        // Hacer POST al endpoint de importacion del backend
        const response = await fetch('/api/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                destino,
                tabla,
                endpoint,
                mapeo,
                // Enviar todos los datos del archivo para que el backend
                // los procese directamente sin pasar por el agente
                datos: archivo.datosCompletos,
            }),
        });

        const resultado = await response.json();
        if (resultado.exitoso) {
            // Mostrar resultado exitoso
            const msg = resultado.data.errores > 0
                ? `Importados: ${resultado.data.insertados} ✓ · Errores: ${resultado.data.errores} ✗`
                : `${resultado.data.insertados} registros importados correctamente`;

            mostrarToast(msg, resultado.data.errores > 0 ? 'info' : 'exito');

        } else {
            mostrarToast(resultado.mensaje || 'Error en la importacion', 'error');
        }

    } catch (e: any) {
        mostrarToast('Error al conectar con el servidor: ' + e.message, 'error');
    }
}