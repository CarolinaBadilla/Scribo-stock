// src/components/Layout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';

export function Layout() {
  const navigate = useNavigate();
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
      localStorage.clear();
      navigate('/login');
    }
  };

  const navItemClass = ({ isActive }) => 
    `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
      isActive 
        ? 'bg-[#5a4a3a] text-white border-[#5a4a3a] shadow-sm' 
        : 'bg-[#fefcf8]/80 text-[#8a7a6a] border-[#e2d8cc] hover:bg-[#fefcf8] hover:text-[#5a4a3a] hover:border-[#c9a87b]'
    }`;

  const mobileNavItemClass = ({ isActive }) => 
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
      isActive 
        ? 'bg-[#5a4a3a] text-white border-[#5a4a3a]' 
        : 'bg-white text-[#8a7a6a] border-[#e2d8cc] hover:bg-[#f5f0e8]'
    }`;

  const userInicial = user.nombre ? user.nombre.charAt(0).toUpperCase() : (user.usuario ? user.usuario.charAt(0).toUpperCase() : 'A');
  const userNombre = user.nombre || user.usuario || 'Usuario';
  const userRol = user.rol === 'jefe' || user.rol === 'DUENO' ? 'Administrador' : 'Operador';

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col text-[#5a4a3a] font-sans antialiased">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 w-full bg-[#fefcf8]/90 backdrop-blur-md border-b border-[#e2d8cc] px-4 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Marca */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#5a4a3a] border border-[#c9a87b] p-1.5 shadow-xs flex items-center justify-center">
                <img 
                  src="/imagenes/Logo Scribo.png" 
                  alt="Scribo Stock" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E📚%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <div className="hidden sm:block leading-tight">
                <span className="font-extrabold text-base tracking-tight text-[#5a4a3a]">SCRIBO</span>
                <span className="block text-[10px] font-bold text-[#c9a87b] uppercase tracking-wider">Gestión de Stock</span>
              </div>
            </div>

            {/* Módulos Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <NavLink to="/ventas" className={navItemClass}>
                <span>🛒</span> Ventas
              </NavLink>
              <NavLink to="/dashboard" className={navItemClass}>
                <span>📊</span> Stock & Panel
              </NavLink>
              <NavLink to="/compras" className={navItemClass}>
                <span>📦</span> Compras
              </NavLink>
              <NavLink to="/reportes" className={navItemClass}>
                <span>📄</span> Reportes
              </NavLink>
            </div>
          </div>

          {/* Bloque Usuario & Mobile Trigger */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 bg-[#f5f0e8]/80 px-3 py-1.5 rounded-xl border border-[#e2d8cc]">
              <div className="w-7 h-7 rounded-lg bg-[#c9a87b] text-white font-black flex items-center justify-center text-xs shadow-xs">
                {userInicial}
              </div>
              <div className="text-left leading-none">
                <p className="text-xs font-bold text-[#5a4a3a]">{userNombre}</p>
                <p className="text-[10px] text-[#8a7a6a] font-medium">{userRol}</p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-[#fefcf8] hover:bg-rose-50 border border-rose-200/80 hover:border-rose-300 rounded-xl transition-all shadow-xs"
              title="Cerrar sesión"
            >
              Salir
            </button>

            {/* Botón Menú Mobile */}
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="md:hidden p-2 rounded-xl bg-[#fefcf8] border border-[#e2d8cc] text-[#5a4a3a]"
            >
              {menuAbierto ? '✖️' : '🍔'}
            </button>
          </div>

        </div>

        {/* Desplegable Mobile */}
        {menuAbierto && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#e2d8cc] flex flex-col gap-2 pb-2">
            <NavLink to="/dashboard" onClick={() => setMenuAbierto(false)} className={mobileNavItemClass}>
              <span>📊</span> Stock & Panel
            </NavLink>
            {!isMobile && (
              <>
                <NavLink to="/ventas" onClick={() => setMenuAbierto(false)} className={mobileNavItemClass}>
                  <span>🛒</span> Ventas
                </NavLink>
                <NavLink to="/compras" onClick={() => setMenuAbierto(false)} className={mobileNavItemClass}>
                  <span>📦</span> Compras
                </NavLink>
                <NavLink to="/reportes" onClick={() => setMenuAbierto(false)} className={mobileNavItemClass}>
                  <span>📄</span> Reportes
                </NavLink>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}