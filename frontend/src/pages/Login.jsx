// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import api from '../services/api'; 

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      window.location.href = '/ventas';
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Petición al backend propio
      const response = await api.post('/autenticacion/iniciar-sesion', {
        email,
        clave: password
      });

      const { token, usuario } = response.data;

      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(usuario));

        // Redirección completa para recargar el AuthContext
        window.location.href = '/ventas';
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setError(
        err.response?.data?.error || 'Email o contraseña incorrectos'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4">
      <div className="w-full max-w-md bg-[#fefcf8] rounded-2xl shadow-md border border-[#e2d8cc] p-8">
        
        {/* Logo y Encabezado */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="w-32 h-32 mb-2 flex items-center justify-center">
            <img 
              src="/imagenes/Logo Scribo.png" 
              alt="Scribo Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-[#5a4a3a] text-center">Scribo Stock</h1>
          <p className="text-[#8a7a6a] text-sm mt-1 text-center">Sistema de gestión de inventario</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5a4a3a] mb-1">
              Email / Usuario
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[#e2d8cc] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a87b] focus:border-[#c9a87b] text-sm bg-[#fefcf8] text-[#5a4a3a]"
              placeholder="usuario@ejemplo.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5a4a3a] mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[#e2d8cc] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a87b] focus:border-[#c9a87b] text-sm bg-[#fefcf8] text-[#5a4a3a]"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8c6b42] text-white font-semibold py-2.5 rounded-lg hover:bg-[#6e5333] transition-all duration-200 disabled:opacity-50 text-base shadow-sm"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

      </div>
    </div>
  );
}