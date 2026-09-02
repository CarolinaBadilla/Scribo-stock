// src/components/Layout.jsx
import { Link, Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [isMobile, setIsMobile] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMenuAbierto(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/autenticacion/cerrar-sesion');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const linkClass = (path) => {
    const baseClass = "px-4 py-2 rounded-xl transition-all duration-200 font-semibold text-sm flex items-center gap-2";
    if (isActive(path)) {
      return `${baseClass} bg-[#5a4a3a] text-white shadow-sm`;
    }
    return `${baseClass} text-[#8a7a6a] hover:bg-[#f5f0e8] hover:text-[#5a4a3a]`;
  };

  const mobileLinkClass = (path) => {
    const baseClass = "px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-3 transition-all";
    if (isActive(path)) {
      return `${baseClass} bg-[#5a4a3a] text-white`;
    }
    return `${baseClass} text-[#8a7a6a] hover:bg-[#f5f0e8]`;
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col text-[#5a4a3a]">
      {/* Barra de Navegación Principal */}
      <nav className="w-full bg-amber-50/50 border-b border-amber-200/60 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Módulos de navegación */}
          <div className="flex flex-wrap items-center gap-2">
            <NavLink to="/ventas" className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white shadow-sm text-amber-900 border border-amber-200' : 'text-amber-800 hover:bg-white/60'}`}>
              🛒 Ventas
            </NavLink>
            <NavLink to="/stock" className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white shadow-sm text-amber-900 border border-amber-200' : 'text-amber-800 hover:bg-white/60'}`}>
              📊 Stock
            </NavLink>
            <NavLink to="/compras" className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white shadow-sm text-amber-900 border border-amber-200' : 'text-amber-800 hover:bg-white/60'}`}>
              📦 Compras
            </NavLink>
            <NavLink to="/reportes" className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white shadow-sm text-amber-900 border border-amber-200' : 'text-amber-800 hover:bg-white/60'}`}>
              📄 Reportes
            </NavLink>
          </div>

          {/* Info Usuario & Salir */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                A
              </div>
              <div className="text-left leading-none">
                <p className="text-xs font-bold text-gray-800">admin</p>
                <p className="text-[10px] text-gray-500">Administrador</p>
              </div>
            </div>
            <button 
              onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>
      
      {/* Contenedor Principal */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}