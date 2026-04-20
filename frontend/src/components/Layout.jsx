// src/components/Layout.jsx
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export function Layout() {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-[#e8e0d5] sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 md:px-8">
          <div className="flex justify-between items-center h-14 md:h-16">
            
            {/* Logo y nombre */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              {/* Logo imagen */}
              <img 
                src="/imagenes/Logo Scribo.png" 
                alt="Scribo Logo" 
                className="w-8 h-8 md:w-9 md:h-9 object-contain"
              />
              {/* Nombre */}
              <span className="text-lg md:text-xl font-bold text-[#5c4b3a] group-hover:text-[#d4a373] transition">
                Scribo Stock
              </span>
            </Link>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium text-sm">🛒 Ventas</Link>
              <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium text-sm">📊 Stock</Link>
              <Link to="/compras" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium text-sm">📦 Compras</Link>
              <Link to="/reportes" className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium text-sm">📄 Reportes</Link>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-xs md:text-sm font-medium">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-xs md:text-sm font-medium text-gray-700">{user.email?.split('@')[0] || 'Usuario'}</p>
                  {user.rol === 'jefe' && <p className="text-xs text-blue-600 -mt-0.5">Admin</p>}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs md:text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main content */}
      <main className="flex-1 pt-3 md:pt-4">
        <div className="w-full px-3 sm:px-4 md:px-5 lg:px-6 fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}