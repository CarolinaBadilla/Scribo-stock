// src/components/Layout.jsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  const handleLogout = async () => {
    try {
      await logout(navigate);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Fallback de seguridad en caso de fallo inesperado
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  const userNombre = usuario?.nombre || usuario?.usuario || 'admin';
  const userInicial = userNombre.charAt(0).toUpperCase();
  const userRol = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO' ? 'Administrador' : 'Operador';
  const esAdmin = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';
  const comercioNombre = usuario?.nombre_comercial || usuario?.nombreComercial || 'Scribo';

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col text-[#5a4a3a] font-sans">
      {/* Barra de Navegación Principal */}
      <nav className="w-full bg-[#fefcf8] border-b border-[#e2d8cc] px-4 md:px-6 py-3 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Brand & Desktop Links */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#5a4a3a] border border-[#c9a87b] p-1.5 flex items-center justify-center shrink-0">
                <img 
                  src="/imagenes/Logo Scribo.png" 
                  alt="Scribo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E📚%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-base tracking-tight text-[#5a4a3a]">SCRIBO</span>
                <span className="block text-[10px] font-bold text-[#c9a87b] uppercase tracking-wider truncate max-w-[120px] md:max-w-[200px]">
                  {comercioNombre}
                </span>
              </div>
            </div>

            {/* Links Módulos Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <NavLink 
                to="/ventas" 
                style={({ isActive }) => ({
                  backgroundColor: isActive ? '#5a4a3a' : '#f5f0e8',
                  color: isActive ? '#ffffff' : '#5a4a3a',
                  border: '1px solid #e2d8cc'
                })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                🛒 Ventas
              </NavLink>

              <NavLink 
                to="/dashboard" 
                style={({ isActive }) => ({
                  backgroundColor: isActive ? '#5a4a3a' : '#f5f0e8',
                  color: isActive ? '#ffffff' : '#5a4a3a',
                  border: '1px solid #e2d8cc'
                })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                📊 Stock & Panel
              </NavLink>

              <NavLink 
                to="/compras" 
                style={({ isActive }) => ({
                  backgroundColor: isActive ? '#5a4a3a' : '#f5f0e8',
                  color: isActive ? '#ffffff' : '#5a4a3a',
                  border: '1px solid #e2d8cc'
                })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                📦 Compras
              </NavLink>

              <NavLink 
                to="/reportes" 
                style={({ isActive }) => ({
                  backgroundColor: isActive ? '#5a4a3a' : '#f5f0e8',
                  color: isActive ? '#ffffff' : '#5a4a3a',
                  border: '1px solid #e2d8cc'
                })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                📄 Reportes
              </NavLink>

              {esAdmin && (
                <NavLink 
                  to="/integraciones" 
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? '#5a4a3a' : '#f5f0e8',
                    color: isActive ? '#ffffff' : '#5a4a3a',
                    border: '1px solid #e2d8cc'
                  })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  ⚙️ Integraciones
                </NavLink>
              )}
            </div>
          </div>

          {/* Usuario & Botón Cerrar Sesión (Desktop y Móvil) */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Info Usuario (visible en desktop y tablets) */}
            <div className="hidden sm:flex items-center gap-2.5 bg-[#f5f0e8] px-3 py-1.5 rounded-xl border border-[#e2d8cc]">
              <div className="w-7 h-7 rounded-lg bg-[#5a4a3a] text-white font-black flex items-center justify-center text-xs">
                {userInicial}
              </div>
              <div className="text-left leading-none">
                <p className="text-xs font-bold text-[#5a4a3a] truncate max-w-[100px] md:max-w-[150px]">{userNombre}</p>
                <p className="text-[10px] text-[#8a7a6a] font-semibold">{userRol}</p>
              </div>
            </div>

            {/* Botón Salir / Cerrar Sesión en Barra Superior */}
            <button 
              type="button"
              onClick={handleLogout}
              style={{ backgroundColor: '#ffffff', color: '#be123c', borderColor: '#fecdd3' }}
              className="px-3 md:px-3.5 py-1.5 text-xs font-bold border rounded-xl hover:bg-rose-50 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              title="Cerrar sesión"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </button>

            {/* Botón Toggle Menú Móvil */}
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              className="md:hidden p-2 rounded-xl border border-[#e2d8cc] bg-[#f5f0e8] text-[#5a4a3a] hover:bg-[#e2d8cc] transition cursor-pointer text-sm font-bold"
              aria-label="Abrir menú"
            >
              {menuMovilAbierto ? '✕' : '☰'}
            </button>
          </div>

        </div>

        {/* Desplegable Menú Móvil */}
        {menuMovilAbierto && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#e2d8cc] flex flex-col gap-2">
            {/* Badge de usuario en menú móvil */}
            <div className="flex sm:hidden items-center gap-2 bg-[#f5f0e8] p-2.5 rounded-xl border border-[#e2d8cc] mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#5a4a3a] text-white font-black flex items-center justify-center text-xs">
                {userInicial}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-[#5a4a3a]">{userNombre}</p>
                <p className="text-[10px] text-[#8a7a6a] font-semibold">{userRol} - {comercioNombre}</p>
              </div>
            </div>

            <NavLink 
              to="/ventas" 
              onClick={() => setMenuMovilAbierto(false)}
              className={({ isActive }) => 
                `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                  isActive ? 'bg-[#5a4a3a] text-white border-[#5a4a3a]' : 'bg-white text-[#5a4a3a] border-[#e2d8cc]'
                }`
              }
            >
              🛒 Ventas
            </NavLink>

            <NavLink 
              to="/dashboard" 
              onClick={() => setMenuMovilAbierto(false)}
              className={({ isActive }) => 
                `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                  isActive ? 'bg-[#5a4a3a] text-white border-[#5a4a3a]' : 'bg-white text-[#5a4a3a] border-[#e2d8cc]'
                }`
              }
            >
              📊 Stock & Panel
            </NavLink>

            <NavLink 
              to="/compras" 
              onClick={() => setMenuMovilAbierto(false)}
              className={({ isActive }) => 
                `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                  isActive ? 'bg-[#5a4a3a] text-white border-[#5a4a3a]' : 'bg-white text-[#5a4a3a] border-[#e2d8cc]'
                }`
              }
            >
              📦 Compras
            </NavLink>

            <NavLink 
              to="/reportes" 
              onClick={() => setMenuMovilAbierto(false)}
              className={({ isActive }) => 
                `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                  isActive ? 'bg-[#5a4a3a] text-white border-[#5a4a3a]' : 'bg-white text-[#5a4a3a] border-[#e2d8cc]'
                }`
              }
            >
              📄 Reportes
            </NavLink>

            {esAdmin && (
              <NavLink 
                to="/integraciones" 
                onClick={() => setMenuMovilAbierto(false)}
                className={({ isActive }) => 
                  `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                    isActive ? 'bg-[#5a4a3a] text-white border-[#5a4a3a]' : 'bg-white text-[#5a4a3a] border-[#e2d8cc]'
                  }`
                }
              >
                ⚙️ Integraciones
              </NavLink>
            )}

            {/* Botón Cerrar Sesión dentro del menú móvil */}
            <button 
              type="button"
              onClick={handleLogout}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold border rounded-xl bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer shadow-xs"
            >
              <span>🚪</span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </nav>
      
      {/* Contenedor Principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
