import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Plugin de Tailwind v4 para Vite
  ],
  resolve: {
    alias: {
      // Permite importar con @ en lugar de rutas relativas
      // Ejemplo: import { Button } from '@/components/ui/Button'
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173, // Puerto del frontend en desarrollo
    proxy: {
      // Todo lo que empiece con /api se redirige al backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // No reescribir la ruta — /api/auth/login sigue siendo /api/auth/login
        // Estas opciones son criticas para que el streaming SSE funcione
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Desactivar buffering para SSE
            proxyReq.setHeader('X-Accel-Buffering', 'no');
          });
        }
      },
    },
  },
  build: {
    // Carpeta de salida del build de produccion
    // El backend de Express servira estos archivos
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});