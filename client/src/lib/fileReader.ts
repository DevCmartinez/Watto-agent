import * as XLSX from 'xlsx';
import { type ArchivoImport } from '@/types';

// Leer un archivo Excel (.xlsx, .xls) o CSV del input del navegador
// Retorna la estructura ArchivoImport con muestra + datos completos
export async function leerArchivo(
    file: File
): Promise<ArchivoImport> {

    // Determinar la extension del archivo
    const extension = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';

    // Leer el archivo como ArrayBuffer (formato binario)
    const buffer = await file.arrayBuffer();

    // Parsear con SheetJS segun el tipo de archivo
    const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,// Convertir fechas de Excel a objetos Date
        raw: false, // Formatear los valores como strings
    });

    // Tomar la primera hoja del libro
    const nombreHoja = workbook.SheetNames[0];
    const hoja = workbook.Sheets[nombreHoja];

    // Convertir la hoja a array de objetos
    // header: 1 = primera fila como array de strings (encabezados)
    const rawData = XLSX.utils.sheet_to_json<string[]>(hoja, {
        header: 1,
        defval: '', // Valor por defecto para celdas vacias
    });

    // La primera fila son los encabezados
    if (rawData.length === 0) {
        throw new Error('El archivo esta vacio o no tiene datos');
    }

    const encabezados = (rawData[0] as string[]).map(h =>
        String(h).trim()
    ).filter(Boolean);

    if (encabezados.length === 0) {
        throw new Error('No se encontraron encabezados en la primera fila');
    }

    // Las filas de datos (sin la primera fila de encabezados)
    const filasDatos = rawData.slice(1).filter(
        (fila: any) => fila.some((celda: any) => celda !== '')
    );

    if (filasDatos.length === 0) {
        throw new Error('El archivo no tiene filas de datos');
    }

    // Convertir filas a objetos usando los encabezados como claves
    // Esto facilita el mapeo posterior
    const datosCompletos = filasDatos.map((fila: any) => {
        const obj: Record<string, string> = {};
        encabezados.forEach((enc, idx) => {
            obj[enc] = String(fila[idx] ?? '').trim();
        });
        return obj;
    });

    // Tomar solo las primeras 5 filas como muestra para el agente
    // El agente no necesita ver todos los datos para generar el mapeo
    const muestra = filasDatos.slice(0, 5).map(
        (fila: any) => encabezados.map((_: any, idx: number) =>
            String(fila[idx] ?? '').trim()
        )
    );

    return {
        nombre: file.name,
        extension,
        totalFilas: filasDatos.length,
        encabezados,
        muestra,
        datosCompletos,
    };
}

// Formatear la muestra del archivo para el mensaje al agente
// Genera un texto legible con encabezados y primeras filas
export function formatearMuestraParaAgente(archivo: ArchivoImport): string {
    const encabezados = archivo.encabezados.join(' | ');
    const separador = archivo.encabezados.map(() => '---').join(' | ');

    return [
        `Archivo: ${archivo.nombre}`,
        `Total de filas: ${archivo.totalFilas}`, ``,
        `Primeras ${archivo.muestra.length} filas de muestra:`,
        `| ${encabezados} |`,
        `| ${separador} |`,
        ...archivo.muestra.map(f => `| ${f.join(' | ')} |`),
    ].join('');
}