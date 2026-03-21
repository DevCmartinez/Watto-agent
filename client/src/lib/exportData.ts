import * as XLSX from 'xlsx';
import { exportarPDF } from './pdfExport';
import { type Mensaje } from '@/types';

// Estructura de datos para exportacion tabular
export interface DatosExport {
    titulo: string; // Nombre del archivo (sin extension)
    encabezados: string[];// Primera fila — nombres de columnas
    filas: string[][]; // Filas de datos

}

// Detectar si el contenido markdown tiene tabla
export function tieneTabla(contenido: string): boolean {
    return contenido.includes('|') &&
        contenido.split('\n').some(l => l.trim().startsWith('|'));
}
// Parsear la primera tabla markdown del contenido
export function parsearTablaMarkdown(contenido: string): DatosExport | null {
    const lineas = contenido.split('\n');
    const filasTabla: string[] = [];
    for (const linea of lineas) {
        if (linea.trim().startsWith('|')) {
            // Saltar separadores |---|---|
            if (!/^\|[\s\-:|]+\|/.test(linea.trim())) {
                filasTabla.push(linea);
            }
        }
    }
    if (filasTabla.length < 2) return null;
    const parsearFila = (linea: string): string[] =>
        linea.trim().replace(/^\||\|$/g, '').split('|')
            .map(c => c.trim()
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/`(.*?)`/g, '$1'));
    return {
        titulo: 'datos',
        encabezados: parsearFila(filasTabla[0]),
        filas: filasTabla.slice(1).map(parsearFila),
    };
}

// Generar y descargar archivo Excel (.xlsx)
export function exportarExcel(datos: DatosExport): void {

    // Crear hoja de calculo con encabezados + filas
    const hojaData = [datos.encabezados, ...datos.filas];
    const hoja = XLSX.utils.aoa_to_sheet(hojaData);

    // Ajustar ancho de columnas automaticamente
    const anchos = datos.encabezados.map((enc, colIdx) => {
        const maxContenido = Math.max(enc.length, ...datos.filas.map(fila => (fila[colIdx] || '').length)
        );
        return { wch: Math.min(maxContenido + 4, 40) };
    });
    hoja['!cols'] = anchos;

    // Crear libro y agregar la hoja
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, datos.titulo.slice(0, 31));

    // Descargar
    XLSX.writeFile(libro, `${datos.titulo}.xlsx`);
}

// Generar y descargar archivo CSV
export function exportarCSV(datos: DatosExport): void {
    const hoja = XLSX.utils.aoa_to_sheet([datos.encabezados, ...datos.filas]);
    const csv = XLSX.utils.sheet_to_csv(hoja);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${datos.titulo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Exportar datos tabulares a PDF usando la funcion existente
// Construye un mensaje artificial con el contenido y lo exporta
export function exportarPDFDatos(
    datos: DatosExport,
    usuario: string
): void {

    // Reconstruir tabla en formato markdown para que exportarPDF la procese
    const encabezado = '| ' + datos.encabezados.join(' | ') + ' |';
    const separador = '| ' + datos.encabezados.map(() => '---').join(' | ') + ' |';
    const filas = datos.filas.map(f => '| ' + f.join(' | ') + ' |').join('\n');
    const contenido = `${encabezado}\n${separador}\n${filas}`;

    // Crear mensaje artificial del agente con la tabla
    const mensajeArtificial: Mensaje = {
        id: 'export-pdf',
        rol: 'assistant',
        contenido: contenido,
        cargando: false,
    };
    const fecha = new Date().toISOString().slice(0, 10);
    const hora = new Date().toLocaleString('es-CO', {
        hour: 'numeric', minute: '2-digit', hour12: true
    }).replace(':', '-').replace(' ', '').replace('.', '');

    exportarPDF([mensajeArtificial], {
        titulo: `${datos.titulo} — Watto Agent`,
        subtitulo: `Usuario: ${usuario}`,
        nombreArchivo: `watto-${datos.titulo}-${fecha}-${hora}.pdf`,
    });
}