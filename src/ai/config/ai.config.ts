import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '../../config/env';

const proveedor = process.env.AI_PROVIDER || 'Proveedor AI no definido';

function crearModelo() {
    if (proveedor === 'openai') {
        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const modelo = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        console.log(`[AI] OpenAI: ${modelo}`);
        return openai(modelo);
    }

    // default: gemini
    console.log(`[AI] Gemini: ${env.ai.modelo}`);
    return google(env.ai.modelo);
}

export const aiModel = crearModelo();

export const AI_CONFIG = {
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    modelo: proveedor === 'openai'
        ? (process.env.OPENAI_MODEL || 'gpt-4o-mini')
        : env.ai.modelo,
    provider: proveedor,
} as const;