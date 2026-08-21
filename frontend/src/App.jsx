// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Ventas } from './pages/Ventas';
import { Dashboard } from './pages/Dashboard';
import { Compras } from './pages/Compras';
import { Reportes } from './pages/Reportes';
import { AlertasStock } from './components/AlertasStock';
import api from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    verificarSesion();
  }, []);

  const verificarSesion = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      // Validar la vigencia del token contra el backend de Node
      await api.get('/autenticacion/perfil');
      setIsAuthenticated(true);
    } catch (error) {
      console.warn('Sesión no válida o token expirado:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f0e8] text-[#5a4a3a]">
        <div className="w-16 h-16 mb-4 rounded-2xl bg-[#fefcf8] border border-[#e2d8cc] p-3 shadow-sm flex items-center justify-center animate-pulse">
          <img 
            src="/imagenes/Logo Scribo.png" 
            alt="Scribo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E📚%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>
        <p className="text-sm font-semibold tracking-wide text-[#8a7a6a] animate-pulse">
          Cargando Scribo Stock...
        </p>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right" 
        richColors 
        toastOptions={{
          style: { borderRadius: '12px', border: '1px solid #e2d8cc', background: '#fefcf8' }
        }}
      />
      
      {isAuthenticated && <AlertasStock />}

      <BrowserRouter>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Layout />}>
                <Route index element={isMobile ? <Navigate to="/dashboard" replace /> : <Ventas />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="ventas" element={isMobile ? <Navigate to="/dashboard" replace /> : <Ventas />} />
                <Route path="compras" element={isMobile ? <Navigate to="/dashboard" replace /> : <Compras />} />
                <Route path="reportes" element={isMobile ? <Navigate to="/dashboard" replace /> : <Reportes />} />
              </Route>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;