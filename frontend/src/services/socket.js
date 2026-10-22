// frontend/src/services/socket.js
import { io } from 'socket.io-client';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = rawUrl.replace(/\/api\/?$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  transports: ['websocket', 'polling'],
  auth: {
    // Se envía el token para pasar el middleware del backend
    token: localStorage.getItem('token')
  }
});

socket.on('connect', () => {
  console.log('🔌 Conectado al WebSocket seguro');
});

socket.on('connect_error', (err) => {
  console.warn('⚠️ Error de conexión WebSocket:', err.message);
});

export default socket;