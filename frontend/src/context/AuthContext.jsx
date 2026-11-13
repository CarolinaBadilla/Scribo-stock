// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const guardado = localStorage.getItem('user') || localStorage.getItem('usuario');
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('token'));
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verificarSesion();
  }, []);

  const limpiarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('usuario');
    localStorage.clear();
    sessionStorage.clear();
    setUsuario(null);
    setIsAuthenticated(false);
  };

  const verificarSesion = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      limpiarSesion();
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/autenticacion/perfil');
      const datos = response.data || JSON.parse(localStorage.getItem('user') || '{}');
      setUsuario(datos);
      setIsAuthenticated(true);
    } catch (error) {
      console.warn('Sesión no válida o token expirado:', error);
      limpiarSesion();
    } finally {
      setLoading(false);
    }
  };

  const login = (token, datosUsuario) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(datosUsuario));
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
    setIsAuthenticated(true);
  };

  const logout = async (navigate) => {
    // 1. Notificar al backend de forma segura
    try {
      await api.post('/autenticacion/cerrar-sesion');
    } catch (error) {
      // Ignorar fallo de red al cerrar sesión
    }

    // 2. Limpieza total de almacenamiento y estado de usuario
    limpiarSesion();

    // 3. Redirección inmediata a /login
    if (typeof navigate === 'function') {
      navigate('/login', { replace: true });
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, isAuthenticated, loading, login, logout, verificarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}
