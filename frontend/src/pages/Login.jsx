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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (perfilError) throw perfilError;

      localStorage.setItem('token', data.session.access_token);
      localStorage.setItem('user', JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        rol: perfil.rol,
        sucursalId: perfil.sucursal_id
      }));

      navigate('/');
    } catch (err) {
      setError('Email o contraseña incorrectos');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo y nombre */}
        <div className="text-center mb-8">
          <img 
              src="/imagenes/Logo Scribo.png" 
              alt="Scribo Logo" 
              className="w-16 h-16 mx-auto mb-3 object-contain"
            />
          <h1 className="text-3xl font-bold text-gray-800">Librería Stock</h1>
          <p className="text-gray-500 mt-1">Sistema de gestión de inventario</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema de gestión para librerías
        </p>
      </div>
    </div>
  );
}