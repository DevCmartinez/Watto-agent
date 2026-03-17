import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Mensaje, type PdfOptions } from '@/types';

// Colores del tema del PDF
const COLORES = {
    azulOscuro: [13, 15, 26] as [number, number, number], // #0d0f1a
    azulMedio: [15, 52, 96] as [number, number, number], // #0f3460
    azulClaro: [227, 242, 253] as [number, number, number], // #e3f2fd
    grisClaro: [245, 245, 250] as [number, number, number], // #f5f5fa
    grisMedio: [200, 200, 210] as [number, number, number], // #c8c8d2
    blanco: [255, 255, 255] as [number, number, number],
    negro: [30, 30, 40] as [number, number, number],
    verde: [39, 174, 96] as [number, number, number],
    rojo: [231, 76, 60] as [number, number, number],
};
const FUENTE_BASE = 10;
const MARGEN_IZQ = 15;
const MARGEN_DER = 15;
const ANCHO_PAGINA = 210; // A4 en mm
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN_IZQ - MARGEN_DER;

// Convierte una linea de markdown a texto plano para el PDF
// Elimina ** __ ` y otros marcadores
function textoPlano(md: string): string {
    return md
        .replace(/\*\*(.*?)\*\*/g, '$1')// **negrita**
        .replace(/__(.*?)__/g, '$1')// __negrita__
        .replace(/\*(.*?)\*/g, '$1')// *cursiva*
        .replace(/_(.*?)_/g, '$1')// _cursiva_
        .replace(/`(.*?)`/g, '$1')// `codigo`
        .replace(/#{1,6}\s/g, '')// ## encabezados
        .trim();
}

// Detecta si una linea es fila de separador de tabla (|---|---|)
function esSeparadorTabla(linea: string): boolean {
    return /^\|[\s\-:|]+\|/.test(linea.trim());
}

// Parsea una fila de tabla markdown y retorna array de celdas
function parsearFilaTabla(linea: string): string[] {
    return linea
        .trim()
        .replace(/^\||\|$/g, '') // quitar pipes iniciales y finales
        .split('|')
        .map(celda => textoPlano(celda.trim()));
}

// Renderiza un mensaje del agente en el PDF
// Detecta tablas, listas, codigo y texto normal
function renderizarMensaje(
    doc: jsPDF,
    texto: string,
    yInicio: number,
    esUsuario: boolean
): number {
    let y = yInicio;
    const lineas = texto.split('');
    let i = 0;

    // Color del autor
    doc.setFontSize(8);
    doc.setTextColor(...(esUsuario ? COLORES.azulMedio : COLORES.verde));
    doc.setFont('helvetica', 'bold');
    doc.text(esUsuario ? 'Tu:' : 'Watto:', MARGEN_IZQ, y);
    y += 5;
    doc.setTextColor(...COLORES.negro);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FUENTE_BASE);
    while (i < lineas.length) {
        const linea = lineas[i];
        const lineaTrim = linea.trim();

        // ■■ Saltar lineas vacias ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (!lineaTrim) { i++; y += 2; continue; }

        // ■■ Encabezados ## ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (lineaTrim.startsWith('## ') || lineaTrim.startsWith('# ')) {
            if (y > 260) { doc.addPage(); y = 20; }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...COLORES.azulMedio);
            const textoHeader = textoPlano(lineaTrim);
            doc.text(textoHeader, MARGEN_IZQ, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FUENTE_BASE);
            doc.setTextColor(...COLORES.negro);
            i++; continue;
        }

        // ■■ Detectar tabla markdown ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (lineaTrim.startsWith('|')) {
            // Recolectar todas las filas de la tabla
            const filasTabla: string[] = [];
            while (i < lineas.length && lineas[i].trim().startsWith('|')) {
                if (!esSeparadorTabla(lineas[i])) {
                    filasTabla.push(lineas[i]);
                }
                i++;
            }
            if (filasTabla.length >= 2) {
                const encabezados = parsearFilaTabla(filasTabla[0]);
                const filasDatos
                    = filasTabla.slice(1).map(parsearFilaTabla);
                if (y > 230) { doc.addPage(); y = 20; }

                // Renderizar tabla con autoTable
                autoTable(doc, {
                    head: [encabezados],
                    body: filasDatos,
                    startY: y,
                    margin: { left: MARGEN_IZQ, right: MARGEN_DER },
                    tableWidth: ANCHO_UTIL,
                    styles: {
                        fontSize: 8.5,
                        cellPadding: 3,
                        overflow: 'linebreak',
                        lineColor: COLORES.grisMedio,
                        lineWidth: 0.3,
                    },
                    headStyles: {
                        fillColor: COLORES.azulMedio,
                        textColor: COLORES.blanco,
                        fontStyle: 'bold',
                        halign: 'left',
                    },
                    alternateRowStyles: {
                        fillColor: COLORES.grisClaro,
                    },
                    bodyStyles: {
                        textColor: COLORES.negro,
                    },
                    didDrawPage: () => { },
                });
                y = (doc as any).lastAutoTable.finalY + 6;
            }
            continue;
        }

        // ■■ Lista con guion o asterisco ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (lineaTrim.startsWith('- ') || lineaTrim.startsWith('* ')) {
            if (y > 270) { doc.addPage(); y = 20; }
            const contenido = textoPlano(lineaTrim.slice(2));
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FUENTE_BASE);
            // Punto decorativo
            doc.setFillColor(...COLORES.azulMedio);
            doc.circle(MARGEN_IZQ + 1.5, y - 1.5, 1, 'F');
            // Texto con wrap
            const wrapped = doc.splitTextToSize(contenido, ANCHO_UTIL - 8);
            doc.text(wrapped, MARGEN_IZQ + 5, y);
            y += wrapped.length * 5 + 1;
            i++; continue;
        }

        // ■■ Lista numerada ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (/^\d+\.\s/.test(lineaTrim)) {
            if (y > 270) { doc.addPage(); y = 20; }
            const numero
                = lineaTrim.match(/^(\d+)\./)?.[1] || '';
            const contenido = textoPlano(lineaTrim.replace(/^\d+\.\s/, ''));
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORES.azulMedio);
            doc.text(`${numero}.`, MARGEN_IZQ, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORES.negro);
            const wrapped = doc.splitTextToSize(contenido, ANCHO_UTIL - 8);
            doc.text(wrapped, MARGEN_IZQ + 6, y);
            y += wrapped.length * 5 + 1;
            i++; continue;
        }

        // ■■ Bloque de codigo ```...``` ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (lineaTrim.startsWith('```')) {
            const codigoLineas: string[] = [];
            i++;
            while (i < lineas.length && !lineas[i].trim().startsWith('```')) {
                codigoLineas.push(lineas[i]);
                i++;
            }
            i++; // saltar el ``` de cierre

            if (codigoLineas.length > 0) {
                if (y > 250) { doc.addPage(); y = 20; }
                const alturaCodigo = codigoLineas.length * 5 + 8;
                doc.setFillColor(...COLORES.azulOscuro);
                doc.roundedRect(MARGEN_IZQ, y - 3, ANCHO_UTIL, alturaCodigo, 2, 2, 'F');
                doc.setFont('courier', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(226, 232, 240);
                codigoLineas.forEach((cl, idx) => {
                    doc.text(cl, MARGEN_IZQ + 3, y + idx * 5);
                });
                y += alturaCodigo + 4;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(FUENTE_BASE);
                doc.setTextColor(...COLORES.negro);
            }
            continue;
        }

        // ■■ Texto normal con negritas ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
        if (y > 270) { doc.addPage(); y = 20; }
        const textoNormal = textoPlano(lineaTrim);
        if (textoNormal) {
            const wrapped = doc.splitTextToSize(textoNormal, ANCHO_UTIL);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FUENTE_BASE);
            doc.setTextColor(...COLORES.negro);
            doc.text(wrapped, MARGEN_IZQ, y);
            y += wrapped.length * 5.5;
        }
        i++;
    }
    return y + 4; // espacio despues del mensaje
}

// Funcion principal — llamar desde el boton del Header
export function exportarPDF(
    mensajes: Mensaje[],
    opciones: PdfOptions
): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ■■ Encabezado de la primera pagina ■■■■■■■■■■■■■■■■■■■■■■■■■■
    // Franja azul oscura de fondo
    doc.setFillColor(...COLORES.azulOscuro);
    doc.rect(0, 0, ANCHO_PAGINA, 32, 'F');

    // Titulo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORES.blanco);
    doc.text(opciones.titulo, MARGEN_IZQ, 13);

    // Subtitulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.grisMedio);
    doc.text(opciones.subtitulo, MARGEN_IZQ, 21);

    // Fecha y hora de exportacion
    const ahora = new Date().toLocaleString('es-CO', {
        dateStyle: 'long', timeStyle: 'short'
    });
    doc.text(`Exportado: ${ahora}`, MARGEN_IZQ, 28);

    // Linea separadora debajo del encabezado
    doc.setDrawColor(...COLORES.azulMedio);
    doc.setLineWidth(0.5);
    doc.line(0, 32, ANCHO_PAGINA, 32);
    let y = 42; // Posicion Y inicial del contenido

    // ■■ Renderizar cada mensaje ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
    const mensajesValidos = mensajes.filter(
        m => !m.cargando && !m.error && m.contenido.trim()
    );
    mensajesValidos.forEach((mensaje, indice) => {
        // Separador entre mensajes (excepto el primero)
        if (indice > 0) {
            doc.setDrawColor(...COLORES.grisMedio);
            doc.setLineWidth(0.2);
            doc.line(MARGEN_IZQ, y, ANCHO_PAGINA - MARGEN_DER, y);
            y += 5;
        }

        // Nueva pagina si ya no hay espacio
        if (y > 265) {
            doc.addPage();
            y = 20;
        }
        y = renderizarMensaje(
            doc,
            mensaje.contenido,
            y,
            mensaje.rol === 'user'
        );
    });

    // ■■ Pie de pagina en todas las paginas ■■■■■■■■■■■■■■■■■■■■■■■■
    const totalPaginas = doc.getNumberOfPages();
    for (let pag = 1; pag <= totalPaginas; pag++) {
        doc.setPage(pag);
        doc.setFillColor(...COLORES.grisClaro);
        doc.rect(0, 287, ANCHO_PAGINA, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORES.grisMedio);
        doc.text('Generado por Watto Agent', MARGEN_IZQ, 293);
        doc.text(`Pagina ${pag} de ${totalPaginas}`,
            ANCHO_PAGINA - MARGEN_DER - 20, 293);
    }

    // ■■ Descargar el archivo ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
    doc.save(opciones.nombreArchivo);
}