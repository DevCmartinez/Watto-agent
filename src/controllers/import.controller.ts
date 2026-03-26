import { Request, Response } from 'express';
import pool from '../config/database';
import { env } from '../config/env';

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
            resultado = await importarEnBD(tabla!, mapeo, datos);
        } else {
            resultado = await importarEnAPI(endpoint!, mapeo, datos);
        }
        res.json({
            exitoso: true,
            mensaje: `Importacion completada: ${resultado.insertados} registros insertados`,
            data: resultado,
        });

    } catch (e: any) {
        console.error('[Import] Error:', e.message);
        res.status(500).json({
            exitoso: false,
            mensaje: 'Error durante la importacion',
            detalle: e.message,
        });
    }
}


// Importar filas en una tabla de MySQL
// Aplica el mapeo de columnas y ejecuta INSERT fila por fila
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
    // a partir del mapeo: { "col_archivo": "campo_bd" }
    const camposBD = Object.values(mapeo);

    // Procesar en lotes de 50 filas para no saturar la conexion
    const LOTE = 50;
    for (let i = 0; i < datos.length; i += LOTE) {
        const lote = datos.slice(i, i + LOTE);

        // Procesar cada fila del lote
        for (const fila of lote) {
            try {
                // Aplicar el mapeo: extraer solo los valores que corresponden
                // a los campos del destino segun el mapeo definido
                const valoresBD: Record<string, string> = {};
                for (const [colArchivo, campoBD] of Object.entries(mapeo)) {
                    valoresBD[campoBD] = fila[colArchivo] ?? '';
                }

                // Construir el INSERT dinamicamente
                const columnas
                    = Object.keys(valoresBD).join(', ');
                const placeholders = Object.keys(valoresBD).map(() => '?').join(', ');
                const valores = Object.values(valoresBD);
                const sql = `INSERT INTO ${tabla} (${columnas}) VALUES (${placeholders})`;
                await pool.query(sql, valores);
                resultado.insertados++;

            } catch (e: any) {
                resultado.errores++;
                resultado.detalles.push(`Fila ${i + lote.indexOf(fila) + 2}: ${e.message}`);
            }
        }
    }
    return resultado;
}

// Importar filas llamando al endpoint de la API externa
// Aplica el mapeo y hace POST por cada fila (o en batch si la API lo soporta)
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

    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    // Headers de autenticacion de la API
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept':
            'application/json',
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
    // Procesar cada fila aplicando el mapeo
    for (let i = 0; i < datos.length; i++) {
        const fila = datos[i];
        try {
            // Construir el JSON de la fila usando el mapeo
            // { campo_api: valor_del_archivo }
            const body: Record<string, string> = {};
            for (const [colArchivo, campoAPI] of Object.entries(mapeo)) {
                body[campoAPI] = fila[colArchivo] ?? '';
            }
            // Hacer POST al endpoint de la API
            const respuesta = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
            });
            if (respuesta.ok) {
                resultado.insertados++;
            } else {
                resultado.errores++;
                resultado.detalles.push(`Fila ${i + 2}: HTTP ${respuesta.status} - ${respuesta.statusText}`);
            }
        } catch (e: any) {
            resultado.errores++;
            resultado.detalles.push(`Fila ${i + 2}: ${e.message}`);
        }
    }
    return resultado;
}