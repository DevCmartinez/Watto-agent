import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import pool from '../config/database';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// GET /api/agent/export?sql=SELECT...&formato=xlsx&titulo=nombre
// Ejecuta el SQL, genera el archivo y lo descarga
export async function exportarArchivo(
    req: Request,
    res: Response
): Promise<void> {
    // Leer parametros de la query string
    const sql = req.query.sql as string;
    const formato = req.query.formato as string;
    const titulo = req.query.titulo as string || 'exportacion';
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
        const [filas] = await pool.query<any[]>(sql);
        const datos = Array.isArray(filas) ? filas : [filas];
        // Si no hay datos, informar al usuario
        if (datos.length === 0) {
            res.status(404).json({ exitoso: false, mensaje: 'La consulta no retorno datos' });
            return;
        }
        // Obtener los encabezados de la primera fila
        const encabezados = Object.keys(datos[0]);
        // Generar el archivo segun el formato solicitado
        const nombreArchivo = titulo.replace(/[^a-z0-9\-_]/gi, '-').toLowerCase();
        if (formato === 'xlsx') {
            await generarExcel(res, datos, encabezados, nombreArchivo);
        } else if (formato === 'csv') {
            generarCSV(res, datos, encabezados, nombreArchivo);
        } else if (formato === 'pdf') {
            await generarPDF(res, datos, encabezados, nombreArchivo, titulo);
        }
    } catch (e: any) {
        console.error('[Export] Error:', e.message);
        res.status(500).json({
            exitoso: false,
            mensaje: 'Error al ejecutar la consulta o generar el archivo',
            detalle: e.message,
        });
    }
}

// Genera y descarga un archivo Excel (.xlsx)
async function generarExcel(
    res: Response,
    datos: any[],
    encabezados: string[],
    nombreArchivo: string
): Promise<void> {
    // Convertir los datos a formato de hoja de calculo
    // aoa = array of arrays: [[encabezado1, encabezado2], [dato1, dato2], ...]
    const filasDatos = datos.map(fila =>
        encabezados.map(col => fila[col] ?? '')
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
    datos: any[],
    encabezados: string[],
    nombreArchivo: string
): void {
    // Construir el CSV manualmente para control total del formato
    // Primera linea: encabezados separados por coma
    const lineas: string[] = [encabezados.join(',')];
    // Siguientes lineas: datos, escapando comas y comillas
    datos.forEach(fila => {
        const valores = encabezados.map(col => {
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
    datos: any[],
    encabezados: string[],
    nombreArchivo: string,
    titulo:
        string
): Promise<void> {
    // Generar documento
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    // Encabezado del documento
    doc.setFillColor(13, 15, 26);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo.replace(/-/g, ' '), 15, 13);
    // Fecha de exportacion en el encabezado
    const fecha = new Date().toLocaleString('es-CO', {
        dateStyle: 'long', timeStyle: 'short'
    });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 210);
    doc.text(`Exportado: ${fecha}`, 200, 13);
    // Tabla de datos con autoTable
    const filasDatos = datos.map(fila =>
        encabezados.map(col => String(fila[col] ?? ''))
    );
    autoTable(doc, {
        head: [encabezados],
        body: filasDatos,
        startY: 25,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 7.5, cellPadding: 3 },
        headStyles: {
            fillColor: [15, 52, 96],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign:
                'center',
        },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        bodyStyles: { textColor: [30, 30, 40], halign: 'center' },
        tableLineWidth: 0,
        didDrawPage: (data: any) => {
            // Pie de pagina en cada pagina
            const pag = doc.getNumberOfPages();
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 160);
            const yPie = 202;
            doc.text('Generado por Watto Agent', 15, yPie);
            doc.text(`Pagina ${pag}`, 270, yPie);
        },
    });
    // Generar buffer y enviar
    const buffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
}