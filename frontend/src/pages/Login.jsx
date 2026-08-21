// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

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
      const response = await api.post('/autenticacion/iniciar-sesion', {
        usuario: email,
        email: email,
        clave: password
      });

      const { token, usuario } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        sucursalId: usuario.sucursalId
      }));

      navigate('/');
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      const mensajeError = err.response?.data?.error || 'Email o contraseña incorrectos';
      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] p-4 sm:p-6">
      <div className="w-full max-w-md bg-[#fefcf8] rounded-2xl shadow-xl border border-[#e2d8cc] p-8 sm:p-10 transition-all">
        
        {/* Identidad de marca */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-28 h-28 mb-3 flex items-center justify-center rounded-2xl bg-[#f5f0e8]/50 p-2 border border-[#e2d8cc]">
            <img 
              src="/imagenes/Logo Scribo.png" 
              alt="Scribo Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-[#5a4a3a] tracking-tight">Scribo Stock</h1>
          <p className="text-[#8a7a6a] text-sm mt-1 font-medium">Gestión integral de inventario y ventas</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5a4a3a] mb-1.5">
              Email o Usuario
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#e2d8cc] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c9a87b] focus:border-transparent text-sm bg-white text-[#5a4a3a] placeholder-[#8a7a6a]/60 transition-all"
              placeholder="usuario@scribo.com.ar"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5a4a3a] mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#e2d8cc] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c9a87b] focus:border-transparent text-sm bg-white text-[#5a4a3a] placeholder-[#8a7a6a]/60 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium border border-red-200 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c9a87b] text-white py-3 rounded-xl font-semibold hover:bg-[#b8976a] active:bg-[#a8865d] transition-all duration-200 shadow-sm disabled:opacity-50 text-sm mt-2"
          >
            {loading ? 'Validando credenciales...' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-[#8a7a6a]">
          &copy; {new Date().getFullYear()} Scribo. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}