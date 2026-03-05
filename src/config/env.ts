import dotenv from "dotenv";
dotenv.config();
// Funcion auxiliar: lanza error si la variable no existe
// Esto hace que la app no arranque si falta una variable critica
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(
      `Variable de entorno requerida no encontrada: ${key}\n` +
        `Asegurate de que existe en el archivo .env`,
    );
  }
  return value;
}

export const env = {
  // ■■ Servidor ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "Tatooine",
  // ■■ Base de datos ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  db: {
    type: (process.env.DB_TYPE || "mysql") as "mysql" | "postgres",
    host: getEnv("DB_HOST", "localhost"),
    port: parseInt(process.env.DB_PORT || "3306", 10),
    name: getEnv("DB_NAME"),
    user: getEnv("DB_USER"),
    password: getEnv("DB_PASSWORD"),
  },
  // ■■ JWT ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  jwt: {
    secret: getEnv("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },
  // ■■ Google Gemini ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  ai: {
    apiKey: getEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
    modelo: process.env.AI_MODEL || "gemini-2.5-flash",
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1000", 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || "0.3"),
  },
  // ■■ Agente autonomo ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  agent: {
    mode: (process.env.AGENT_MODE || "db") as "db" | "api" | "both",
    name: process.env.AGENT_NAME || "Watto",
    context: process.env.AGENT_CONTEXT || "Sistema de gestion de datos",
    db: {
      excludeTables: (process.env.AGENT_DB_EXCLUDE_TABLES || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      maxRows: parseInt(process.env.AGENT_DB_MAX_ROWS || "100", 10),
    },
    api: {
      openApiUrl: process.env.AGENT_API_OPENAPI_URL || "",
      baseUrl: process.env.AGENT_API_BASE_URL || "",
      authToken: process.env.AGENT_API_AUTH_TOKEN || "",
      authType: (process.env.AGENT_API_AUTH_TYPE || "none") as
        "bearer"| "basic"| "apikey"| "none",
    },
  },
} as const;
