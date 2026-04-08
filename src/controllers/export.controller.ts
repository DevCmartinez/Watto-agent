import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tipo para filas de datos (objetos con claves dinámicas)
type DataRow = Record<string, unknown>;

// Palabras SQL que NUNCA se permiten en exportacion
// El agente solo puede leer datos, nunca modificar
const SQL_BLOQUEADO = [
    'insert', 'update', 'delete', 'drop',
    'truncate', 'alter', 'create', 'grant', 'revoke'
];

// Validar que el SQL sea seguro antes de ejecutarlo
function validarSQL(sql: string): { valido: boolean; error?: string } {
    const sqlLower = sql.toLowerCase().trim();
    // Solo permitir SELECT
    if (!sqlLower.startsWith('select')) {
        return { valido: false, error: 'Solo se permiten consultas SELECT' };
    }
    // Verificar que no contenga operaciones peligrosas
    for (const palabra of SQL_BLOQUEADO) {
        const regex = new RegExp(`\\b${palabra}\\b`, 'i');
        if (regex.test(sqlLower)) {
            return { valido: false, error: `Operacion '${palabra}' no permitida` };
        }
    }
    return { valido: true };
}

// POST /api/export  { sql, formato, titulo }
// Ejecuta el SQL, genera el archivo y lo descarga
// SEC-04: El SQL viaja en el body (POST) para evitar que quede en logs/URLs
export async function exportarArchivo(
    req: Request,
    res: Response
): Promise<void> {
    // Leer parametros del body (POST)
    const sql = req.body.sql as string;
    const formato = req.body.formato as string;
    const titulo = (req.body.titulo as string) || 'exportacion';
    // Validar que los parametros existan
    if (!sql || !formato) {
        res.status(400).json({ exitoso: false, mensaje: 'sql y formato son requeridos' });
        return;
    }
    // Validar que el formato sea valido
    const formatosValidos = ['xlsx', 'csv', 'pdf'];
    if (!formatosValidos.includes(formato.toLowerCase())) {
        res.status(400).json({ exitoso: false, mensaje: 'Formato invalido. Usa: xlsx, csv, pdf' });
        return;
    }
    // Validar seguridad del SQL
    const validacion = validarSQL(sql);
    if (!validacion.valido) {
        res.status(400).json({ exitoso: false, mensaje: validacion.error });
        return;
    }
    try {
        // Ejecutar el SQL contra MySQL
        // El LIMIT viene en el SQL que genero el agente
        const [filas] = await pool.query<RowDataPacket[]>(sql);
        const datos: DataRow[] = Array.isArray(filas) ? filas : [filas];
        // Si no hay datos, informar al usuario
        if (datos.length === 0) {
            res.status(404).json({ exitoso: false, mensaje: 'La consulta no retorno datos' });
            return;
        }
        // Obtener los encabezados de la primera fila
        const encabezados = Object.keys(datos[0] as DataRow);
        // Generar el archivo segun el formato solicitado
        const nombreArchivo = titulo.replace(/[^a-z0-9\-_]/gi, '-').toLowerCase();
        if (formato === 'xlsx') {
            await generarExcel(res, datos, encabezados, nombreArchivo);
        } else if (formato === 'csv') {
            generarCSV(res, datos, encabezados, nombreArchivo);
        } else if (formato === 'pdf') {
            await generarPDF(res, datos, encabezados, nombreArchivo, titulo);
        }
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[Export] Error:', errorMessage);
        res.status(500).json({
            exitoso: false,
            mensaje: 'Error al ejecutar la consulta o generar el archivo',
            detalle: errorMessage,
        });
    }
}

// Genera y descarga un archivo Excel (.xlsx)
async function generarExcel(
    res: Response,
    datos: DataRow[],
    encabezados: string[],
    nombreArchivo: string
): Promise<void> {
    // Convertir los datos a formato de hoja de calculo
    // aoa = array of arrays: [[encabezado1, encabezado2], [dato1, dato2], ...]
    const filasDatos = datos.map((fila: DataRow) =>
        encabezados.map((col) => (fila[col] ?? ''))
    );
    const hojaData = [encabezados, ...filasDatos];
    const hoja = XLSX.utils.aoa_to_sheet(hojaData);

    // Ajustar el ancho de cada columna automaticamente
    // segun el contenido mas largo de cada columna
    hoja['!cols'] = encabezados.map((enc, idx) => ({
        wch: Math.min(
            Math.max(
                enc.length,
                ...datos.map(f => String(f[enc] ?? '').length)
            ) + 4,
            50 // Maximo 50 caracteres de ancho
        ),
    }));

    // Crear el libro de Excel y agregar la hoja
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, nombreArchivo.slice(0, 31));

    // Generar el buffer del archivo
    const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });

    // Configurar headers de descarga y enviar
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
}

// Genera y descarga un archivo CSV
function generarCSV(
    res: Response,
    datos: DataRow[],
    encabezados: string[],
    nombreArchivo: string
): void {
    // Construir el CSV manualmente para control total del formato
    // Primera linea: encabezados separados por coma
    const lineas: string[] = [encabezados.join(',')];
    // Siguientes lineas: datos, escapando comas y comillas
    datos.forEach((fila: DataRow) => {
        const valores = encabezados.map((col) => {
            const valor = String(fila[col] ?? '');
            // Si el valor contiene coma o comilla, envolverlo en comillas dobles
            return valor.includes(',') || valor.includes('"') ? `"${valor.replace(/"/g, '""')}"` : valor;
        });
        lineas.push(valores.join(','));
    });
    const csv = lineas.join('\n');
    // Configurar headers de descarga y enviar
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // BOM para que Excel abra el CSV con UTF-8 correctamente
    res.send('\uFEFF' + csv);
}

// Genera y descarga un archivo PDF con los datos en tabla
async function generarPDF(
    res: Response,
    datos: DataRow[],
    encabezados: string[],
    nombreArchivo: string,
    titulo: string
): Promise<void> {
    // Determinar orientación y formato basado en la cantidad de columnas
    // Si hay más de 12 columnas, usamos A3 para dar más espacio horizontal
    const numCols = encabezados.length;
    const format = numCols > 12 ? 'a3' : 'a4';
    const orientation = 'landscape';

    // Generar documento
    const doc = new jsPDF({ orientation, unit: 'mm', format });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Estilo de cabecera dinámica
    doc.setFillColor(13, 15, 26);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(pageWidth > 300 ? 16 : 13);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo.replace(/-/g, ' ').toUpperCase(), 15, 13);

    // Fecha de exportación
    const fecha = new Date().toLocaleString('es-CO', {
        dateStyle: 'long', timeStyle: 'short'
    });
    doc.setFontSize(pageWidth > 300 ? 10 : 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 210);
    doc.text(`Exportado: ${fecha}`, pageWidth - 70, 13);

    // Ajuste dinámico de fuente para que quepa todo
    // Base 8.5, bajando hasta 6 si hay muchas columnas
    const fontSize = Math.max(9 - (numCols > 8 ? (numCols - 8) * 0.4 : 0), 5.5);

    // Mapeo de datos
    const filasDatos = datos.map((fila: DataRow) =>
        encabezados.map((col) => {
            const val = fila[col];
            if (val === null || val === undefined) return '';
            // Si es fecha, formatear un poco
            if (val instanceof Date) return val.toLocaleDateString();
            return String(val);
        })
    );

    // Tabla de datos con autoTable
    autoTable(doc, {
        head: [encabezados],
        body: filasDatos,
        startY: 25,
        margin: { left: 10, right: 10, bottom: 20 },
        tableWidth: 'auto',
        styles: { 
            fontSize, 
            cellPadding: 2, 
            overflow: 'linebreak',
            cellWidth: 'auto',
            valign: 'middle'
        },
        headStyles: {
            fillColor: [15, 52, 96],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        bodyStyles: { textColor: [30, 30, 40], halign: 'left' },
        columnStyles: {
            // Podemos forzar que IDs o números cortos no ocupen tanto
            // pero 'auto' suele ser mejor
        },
        didDrawPage: (data: any) => {
            const pag = doc.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 160);
            const yPie = doc.internal.pageSize.getHeight() - 10;
            doc.text(`Generado por Watto Agent · Sistema de Control Institucional`, 10, yPie);
            doc.text(`Página ${pag}`, pageWidth - 25, yPie);
        },
    });

    // Generar buffer y enviar
    const buffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
}