import { google } from '@ai-sdk/google';
// Lee GOOGLE_GENERATIVE_AI_API_KEY automaticamente desde process.env
export const aiModel= google(process.env.AI_MODEL || 'gemini-2.5-flash');
export const aiModelPro = google('gemini-2.5-flash-preview-05-20');
export const AI_CONFIG = {
maxTokens:
parseInt(process.env.AI_MAX_TOKENS || '1000', 10),
temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
modelo:process.env.AI_MODEL || 'gemini-2.5-flash',
provider:'google-gemini',
} as const;
console.log(`[Modelo AI] => ${AI_CONFIG.modelo}`);