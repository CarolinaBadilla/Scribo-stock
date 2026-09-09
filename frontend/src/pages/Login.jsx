// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import api from '../services/api'; 

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const response = await api.post('/autenticacion/iniciar-sesion', {
        email,
        clave: password
      });

      const { token, usuario } = response.data;

      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(usuario));
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] px-4 py-12">
      <div className="w-full max-w-md bg-[#fefcf8] rounded-2xl shadow-xl border border-[#e2d8cc] p-8 md:p-10">
        
        {/* Isologotipo & Encabezado */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-28 h-20 mb-3 flex items-center justify-center">
            <img 
              src="/imagenes/Logo Scribo.png" 
              alt="Scribo Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E📚%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-[#5a4a3a] tracking-tight text-center">
            SCRIBO STOCK
          </h1>
          <p className="text-[#8a7a6a] text-xs font-bold uppercase tracking-wider mt-1 text-center">
            Gestión Integral de Inventario
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          
          {/* Input Email */}
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-2">
              Correo Electrónico / Usuario
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-[#e2d8cc] rounded-xl focus:outline-none focus:border-[#5a4a3a] text-sm font-bold text-[#5a4a3a] bg-white placeholder-[#8a7a6a]/60 shadow-xs"
              placeholder="alina@biopyme.com"
              required
            />
          </div>

          {/* Input Contraseña */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#5a4a3a] mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-16 py-3 border border-[#e2d8cc] rounded-xl focus:outline-none focus:border-[#5a4a3a] text-sm font-bold text-[#5a4a3a] bg-white placeholder-[#8a7a6a]/60 shadow-xs"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8a7a6a] hover:text-[#5a4a3a] px-2 py-1 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200">
              {error}
            </div>
          )}

          {/* Botón Marrón Corporativo Forzado */}
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: '#5a4a3a', color: '#ffffff' }}
            className="w-full mt-2 font-bold py-3.5 px-4 rounded-xl text-sm shadow-md hover:brightness-110 transition-all cursor-pointer border border-[#43372b]"
          >
            {loading ? 'Ingresando...' : 'Ingresar al Sistema →'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#e2d8cc]/60 text-center">
          <p className="text-[11px] font-medium text-[#8a7a6a]">
            Scribo Gestión © {new Date().getFullYear()} — Acceso Restringido
          </p>
        </div>

      </div>
    </div>
  );
}