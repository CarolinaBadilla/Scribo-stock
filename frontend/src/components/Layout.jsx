// src/components/Layout.jsx - Versión con espaciado corregido
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
      {/* Navbar con padding lateral aumentado */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-6 sm:px-8 md:px-10">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
                <span className="text-white text-xl">📚</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-800">Librería</h1>
                <p className="text-xs text-gray-500 -mt-0.5">Stock Manager</p>
              </div>
            </Link>
            
            {/* Navigation Links - centrados */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium">🛒 Ventas</Link>
              <Link to="/dashboard" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium">📊 Stock</Link>
              <Link to="/compras" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium">📦 Compras</Link>
              <Link to="/reportes" className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium">📄 Reportes</Link>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-medium">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
                <div className="hidden lg:block">
                  <p className="text-sm font-medium text-gray-700">{user.email?.split('@')[0] || 'Usuario'}</p>
                  {user.rol === 'jefe' && <p className="text-xs text-blue-600 -mt-0.5">Administrador</p>}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main content con más espacio arriba */}
      <main className="flex-1 pt-4 md:pt-6">
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}