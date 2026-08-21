// src/components/Layout.jsx
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
      <nav className="bg-[#fefcf8] border-b border-[#e2d8cc] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            
            {/* Identidad / Logo */}
            <Link to={isMobile ? "/dashboard" : "/"} className="flex items-center gap-3 group shrink-0">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[#f5f0e8] border border-[#e2d8cc] p-1.5 flex items-center justify-center group-hover:border-[#c9a87b] transition-all">
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
              <div>
                <span className="text-lg md:text-xl font-bold tracking-tight text-[#5a4a3a] group-hover:text-[#c9a87b] transition-colors block">
                  Scribo
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8a7a6a] -mt-1 block">
                  Stock System
                </span>
              </div>
            </Link>
            
            {/* Navegación Desktop */}
            {!isMobile && (
              <div className="hidden md:flex items-center gap-1.5 bg-[#f5f0e8]/50 p-1.5 rounded-2xl border border-[#e2d8cc]/60">
                <Link to="/" className={linkClass('/')}>
                  <span>🛒</span> Ventas
                </Link>
                <Link to="/dashboard" className={linkClass('/dashboard')}>
                  <span>📊</span> Stock
                </Link>
                <Link to="/compras" className={linkClass('/compras')}>
                  <span>📦</span> Compras
                </Link>
                <Link to="/reportes" className={linkClass('/reportes')}>
                  <span>📄</span> Reportes
                </Link>
              </div>
            )}
            
            {/* Panel de Usuario & Acciones */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2.5 bg-[#f5f0e8]/40 pl-2.5 pr-3 py-1.5 rounded-xl border border-[#e2d8cc]/60">
                <div className="w-8 h-8 rounded-lg bg-[#c9a87b] flex items-center justify-center shadow-xs">
                  <span className="text-white text-xs font-bold uppercase">
                    {(user.email || user.usuario || 'U').charAt(0)}
                  </span>
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-[#5a4a3a] leading-tight">
                    {(user.email || user.usuario || 'Usuario').split('@')[0]}
                  </p>
                  <p className="text-[10px] font-semibold text-[#8a7a6a] capitalize">
                    {user.rol === 'jefe' || user.rol === 'DUENO' ? 'Administrador' : 'Empleado'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all"
                title="Cerrar sesión"
              >
                Salir
              </button>

              {/* Botón Menú Móvil */}
              {isMobile && (
                <button
                  onClick={() => setMenuAbierto(!menuAbierto)}
                  className="p-2 rounded-xl bg-white border border-[#e2d8cc] text-[#5a4a3a] hover:bg-[#f5f0e8] text-lg font-bold"
                >
                  {menuAbierto ? '✕' : '☰'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desplegable Móvil */}
        {isMobile && menuAbierto && (
          <div className="md:hidden border-t border-[#e2d8cc] bg-[#fefcf8] px-4 py-3 space-y-1 shadow-lg">
            <Link to="/" onClick={() => setMenuAbierto(false)} className={mobileLinkClass('/')}>
              <span>🛒</span> Ventas
            </Link>
            <Link to="/dashboard" onClick={() => setMenuAbierto(false)} className={mobileLinkClass('/dashboard')}>
              <span>📊</span> Control de Stock
            </Link>
            <Link to="/compras" onClick={() => setMenuAbierto(false)} className={mobileLinkClass('/compras')}>
              <span>📦</span> Registro de Compras
            </Link>
            <Link to="/reportes" onClick={() => setMenuAbierto(false)} className={mobileLinkClass('/reportes')}>
              <span>📄</span> Reportes e Históricos
            </Link>
          </div>
        )}
      </nav>
      
      {/* Contenedor Principal */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}