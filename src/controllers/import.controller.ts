import { Request, Response } from 'express';
import pool from '../config/database';
import { env } from '../config/env';
import { RowDataPacket } from 'mysql2';

// Estructura del body que recibe el endpoint
interface ImportBody {
    destino: 'bd' | 'api';// A donde importar
    tabla?: string;// Nombre de la tabla en MySQL (si destino=bd)
    endpoint?: string;// Ruta del endpoint de la API (si destino=api)
    mapeo: Record<string, string>; // { columnaArchivo: campoBD/campoAPI }
    datos: Record<string, string>[]; // Array de objetos con los datos del archivo
}

// Resultado de la importacion
interface ResultadoImport {
    insertados: number;
    errores: number;
    detalles: string[];
}

/**
 * SEC-02: Obtiene la lista de tablas reales existentes en la BD para whitelist.
 * Previene SQL injection via nombre de tabla.
 */
async function tablasDisponibles(): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    return rows.map((r) => (r.TABLE_NAME || r.table_name) as string);
}

// POST /api/import
// Recibe mapeo + datos y los inserta en BD o API
export async function importarDatos(
    req: Request,
    res: Response
): Promise<void> {
    const { destino, tabla, endpoint, mapeo, datos } = req.body as ImportBody;

    // Validaciones basicas
    if (!destino || !mapeo || !datos || datos.length === 0) {
        res.status(400).json({
            exitoso: false,
            mensaje: 'destino, mapeo y datos son requeridos'
        });
        return;
    }

    // SEC-11: Limitar tamaño del payload para prevenir DoS
    const pesoBytes = Buffer.byteLength(JSON.stringify(datos), 'utf-8');
    const MAX_PESO_MB = 10;
    if (pesoBytes > MAX_PESO_MB * 1024 * 1024) {
        res.status(413).json({
            exitoso: false,
            mensaje: `El archivo supera el tamaño máximo permitido de ${MAX_PESO_MB}MB.`
        });
        return;
    }

    if (destino === 'bd' && !tabla) {
        res.status(400).json({
            exitoso: false,
            mensaje: 'El campo tabla es requerido cuando destino=bd'
        });
        return;
    }

    if (destino === 'api' && !endpoint) {
        res.status(400).json({
            exitoso: false,
            mensaje: 'El campo endpoint es requerido cuando destino=api'
        });
        return;
    }

    try {
        let resultado: ResultadoImport;

        if (destino === 'bd') {
            // SEC-02: Validar que la tabla existe en la BD antes de insertar
            const tablas = await tablasDisponibles();
            if (!tablas.includes(tabla!)) {
                res.status(400).json({
                    exitoso: false,
                    mensaje: `Tabla '${tabla}' no existe o no está disponible para importación.`
                });
                return;
            }
            resultado = await importarEnBD(tabla!, mapeo, datos);
        } else {
            // SEC-05: Validar endpoint contra path traversal y protocol injection
            const endpointNorm = (endpoint || '').replace(/^\/+/, '');
            if (
                endpointNorm.includes('..') ||
                /^https?:\/\//i.test(endpointNorm) ||
                endpointNorm.includes('\0') ||
                /[<>"'{}|\\^[\]`]/.test(endpointNorm)
            ) {
                res.status(400).json({
                    exitoso: false,
                    mensaje: 'El endpoint contiene caracteres o secuencias no permitidas.'
                });
                return;
            }
            resultado = await importarEnAPI(endpointNorm, mapeo, datos);
        }

        res.json({
            exitoso: true,
            mensaje: `Importacion completada: ${resultado.insertados} registros insertados`,
            data: resultado,
        });

    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[Import] Error:', errorMessage);
        res.status(500).json({
            exitoso: false,
            mensaje: 'Error durante la importacion',
            detalle: errorMessage,
        });
    }
}


// Importar filas en una tabla de MySQL
// Usa batch inserts para rendimiento óptimo
async function importarEnBD(
    tabla: string,
    mapeo: Record<string, string>,
    datos: Record<string, string>[]
): Promise<ResultadoImport> {

    const resultado: ResultadoImport = {
        insertados: 0,
        errores: 0,
        detalles: [],
    };

    // Obtener los campos del destino (columnas de la BD)
    const camposBD = Object.keys(mapeo);

    // Procesar en lotes de 50 filas para no saturar la conexion
    const LOTE = 50;
    for (let i = 0; i < datos.length; i += LOTE) {
        const lote = datos.slice(i, i + LOTE);

        try {
            // Construir el batch insert: INSERT INTO tabla (col1, col2) VALUES (?, ?), (?, ?), ...
            const columnas = camposBD.join(', ');
            const placeholdersPorFila = camposBD.map(() => '?').join(', ');
            const placeholders = lote.map(() => `(${placeholdersPorFila})`).join(', ');

            // Flatten: [fila1_val1, fila1_val2, fila2_val1, fila2_val2, ...]
            const valores = lote.flatMap((fila) =>
                camposBD.map((campoBD) => {
                    const colArchivo = Object.keys(mapeo).find((k) => mapeo[k] === campoBD) || '';
                    return fila[colArchivo] ?? '';
                })
            );

            const sql = `INSERT INTO ${tabla} (${columnas}) VALUES ${placeholders}`;
            await pool.query(sql, valores);
            resultado.insertados += lote.length;

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
            resultado.errores += lote.length;
            resultado.detalles.push(`Lote ${i / LOTE + 1}: ${errorMessage}`);
        }
    }
    return resultado;
}

// PERF-03: Importar filas llamando al endpoint de la API externa
// Usa concurrencia de hasta 5 requests paralelos para mejorar performance
async function importarEnAPI(
    endpoint: string,
    mapeo: Record<string, string>,
    datos: Record<string, string>[]
): Promise<ResultadoImport> {

    const resultado: ResultadoImport = {
        insertados: 0,
        errores: 0,
        detalles: [],
    };

    // Construir la URL completa del endpoint de la API
    const baseUrl = env.agent.api.baseUrl;

    if (!baseUrl) {
        throw new Error('AGENT_API_BASE_URL no esta configurado en .env');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint}`;

    // Headers de autenticacion de la API
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    if (env.agent.api.authToken) {
        const tipos: Record<string, string> = {
            bearer: `Bearer ${env.agent.api.authToken}`,
            basic: `Basic ${env.agent.api.authToken}`,
            apikey: env.agent.api.authToken,
        };
        const headerNombre = env.agent.api.authType === 'apikey' ? 'X-API-Key' : 'Authorization';
        headers[headerNombre] = tipos[env.agent.api.authType] || env.agent.api.authToken;
    }

    // PERF-03: Procesamiento en lotes concurrentes (5 requests en paralelo)
    const CONCURRENCIA = 5;
    for (let i = 0; i < datos.length; i += CONCURRENCIA) {
        const lote = datos.slice(i, i + CONCURRENCIA);

        const resultados = await Promise.allSettled(lote.map(async (fila, idxEnLote) => {
            const body: Record<string, string> = {};
            for (const [colArchivo, campoAPI] of Object.entries(mapeo)) {
                body[campoAPI] = fila[colArchivo] ?? '';
            }
            const respuesta = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (respuesta.ok) {
                return { exito: true };
            } else {
                return {
                    exito: false,
                    mensaje: `Fila ${i + idxEnLote + 2}: HTTP ${respuesta.status} - ${respuesta.statusText}`
                };
            }
        }));

        for (const r of resultados) {
            if (r.status === 'fulfilled') {
                if (r.value.exito) {
                    resultado.insertados++;
                } else {
                    resultado.errores++;
                    resultado.detalles.push(r.value.mensaje!);
                }
            } else {
                resultado.errores++;
                resultado.detalles.push(`Error en lote ${i + 1}: ${(r as PromiseRejectedResult).reason?.message || 'desconocido'}`);
            }
        }
    }
    return resultado;
}