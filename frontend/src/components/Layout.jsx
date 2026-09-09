// src/components/Layout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../services/api';

export function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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

  const userInicial = user.nombre ? user.nombre.charAt(0).toUpperCase() : (user.usuario ? user.usuario.charAt(0).toUpperCase() : 'A');
  const userNombre = user.nombre || user.usuario || 'admin';
  const userRol = user.rol === 'jefe' || user.rol === 'DUENO' ? 'Administrador' : 'Operador';

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex flex-col text-[#5a4a3a] font-sans">
      {/* Barra de Navegación Principal con espacio interno */}
      <nav className="w-full bg-[#fefcf8] border-b border-[#e2d8cc] px-6 py-3 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand & Links */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#5a4a3a] border border-[#c9a87b] p-1.5 flex items-center justify-center">
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
                <span className="block text-[10px] font-bold text-[#c9a87b] uppercase tracking-wider">Stock System</span>
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
            </div>
          </div>

          {/* Usuario & Botón Salir */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 bg-[#f5f0e8] px-3 py-1.5 rounded-xl border border-[#e2d8cc]">
              <div className="w-7 h-7 rounded-lg bg-[#5a4a3a] text-white font-black flex items-center justify-center text-xs">
                {userInicial}
              </div>
              <div className="text-left leading-none">
                <p className="text-xs font-bold text-[#5a4a3a]">{userNombre}</p>
                <p className="text-[10px] text-[#8a7a6a] font-semibold">{userRol}</p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              style={{ backgroundColor: '#ffffff', color: '#be123c', borderColor: '#fecdd3' }}
              className="px-3.5 py-1.5 text-xs font-bold border rounded-xl hover:bg-rose-50 transition-colors shadow-xs cursor-pointer"
            >
              Salir
            </button>
          </div>

        </div>
      </nav>
      
      {/* Contenedor Principal Restaurado con Margen Lateral (max-w-7xl y px-6 py-6) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}