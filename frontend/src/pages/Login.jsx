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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4">
      <div className="max-w-md w-full">
        {/* Logo más grande y centrado */}
        <div className="text-center mb-10">
          <img 
            src="/imagenes/Logo Scribo.png" 
            alt="Scribo Logo" 
            className="w-32 h-32 mx-auto mb-5 object-contain"
          />
          <h1 className="text-3xl font-bold text-[#5a4a3a]">Scribo Stock</h1>
          <p className="text-[#8a7a6a] text-base mt-2">Sistema de gestión de inventario</p>
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
  );
}