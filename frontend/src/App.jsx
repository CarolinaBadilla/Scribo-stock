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
import { supabase } from './services/supabase';
import { AlertasStock } from './components/AlertasStock';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarSesion = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('Error:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    
    verificarSesion();
    
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <div className="text-[#5a4a3a]">Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
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
                <Route index element={<Ventas />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="ventas" element={<Ventas />} />
                <Route path="compras" element={<Compras />} />
                <Route path="reportes" element={<Reportes />} />
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