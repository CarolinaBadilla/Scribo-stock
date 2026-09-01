// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        // Petición al backend propio (api.scribo.com.ar)
        const response = await api.post('/autenticacion/iniciar-sesion', {
          email,     // O usuario, según lo que ingrese el cliente
          clave: password
        });

        const { token, usuario } = response.data;

        if (token) {
          // 1. Guardar token y datos del usuario en localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(usuario));

          // 2. Redirección completa para recargar el AuthContext y montar la app limpia
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
      <div className="max-w-md w-full">
        {/* Logo más grande y centrado */}
        <div className="flex flex-col items-center justify-center mb-10">
        <div className="w-36 h-36 mb-4 flex items-center justify-center">
            <img 
              src="/imagenes/Logo Scribo.png" 
              alt="Scribo Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-[#5a4a3a] text-center">Scribo Stock</h1>
          <p className="text-[#8a7a6a] text-base mt-2 text-center">Sistema de gestión de inventario</p>
        </div>

        {/* Formulario compacto */}
        <div className="bg-[#fefcf8] rounded-2xl shadow-sm border border-[#e2d8cc] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#5a4a3a] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-[#e2d8cc] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a87b] focus:border-[#c9a87b] text-sm bg-[#fefcf8]"
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
                className="w-full px-3 py-2 border border-[#e2d8cc] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a87b] focus:border-[#c9a87b] text-sm bg-[#fefcf8]"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-2 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a87b] text-white py-2.5 rounded-lg font-medium hover:bg-[#a8865d] transition-all duration-200 disabled:opacity-50 text-base"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}