// src/components/Layout.jsx
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  // Función para saber si un link está activo
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Clases para links según estén activos o no
  const linkClass = (path) => {
    const baseClass = "px-4 py-2 rounded-lg transition-all duration-200 font-medium text-base";
    if (isActive(path)) {
      return `${baseClass} bg-[#c9a87b] text-white shadow-sm`;
    }
    return `${baseClass} text-[#8a7a6a] hover:bg-[#ede5d9] hover:text-[#c9a87b]`;
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col">
      {/* Navbar */}
      <nav className="bg-[#fefcf8] border-b border-[#e2d8cc] sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            
            {/* Logo más grande */}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
                <img 
                  src="/imagenes/Logo Scribo.png" 
                  alt="Scribo Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-base md:text-lg font-bold text-[#5a4a3a] group-hover:text-[#c9a87b] transition">
                Scribo Stock
              </span>
            </Link>
            
            {/* Navigation Links - más grandes y separados */}
            <div className="hidden md:flex items-center gap-2 lg:gap-3">
              <Link to="/" className={linkClass('/')}>
                🛒 Ventas
              </Link>
              <Link to="/dashboard" className={linkClass('/dashboard')}>
                📊 Stock
              </Link>
              <Link to="/compras" className={linkClass('/compras')}>
                📦 Compras
              </Link>
              <Link to="/reportes" className={linkClass('/reportes')}>
                📄 Reportes
              </Link>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-9 md:h-9 bg-[#c9a87b] rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-medium text-[#5a4a3a]">{user.email?.split('@')[0] || 'Usuario'}</p>
                  {user.rol === 'jefe' && <p className="text-xs text-[#c9a87b] -mt-0.5">Administrador</p>}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-[#b87a6a] hover:bg-[#ede5d9] rounded-lg transition font-medium"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main content */}
      <main className="flex-1 pt-4 md:pt-5">
        <div className="w-full px-3 sm:px-4 md:px-5 lg:px-6 fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}