import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { ChatPage } from '@/pages/ChatPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Toast } from '@/components/ui/Toast';

export default function App() {
  return (
    <>
      <Routes>
        {/* Ruta publica — login */}
        <Route path="/login" element={<LoginPage />} />
        {/* Ruta protegida — chat */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        {/* Cualquier ruta desconocida redirige al chat */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Toast global — visible desde cualquier pagina */}
      <Toast />
    </>
  );
}
