import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css'
import App from './App.tsx'

// Configuracion global del cliente de queries
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cuanto tiempo los datos se consideran frescos (no refetch)
      staleTime:
        1000 * 60 * 2, // 2 minutos
      // Cuanto tiempo se guarda en cache sin usar
      gcTime:
        1000 * 60 * 10, // 10 minutos
      // No reintentar en errores 401/403 (no tiene sentido)
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
