// frontend/src/services/socket.js
import { io } from 'socket.io-client';

// Extraer la URL base eliminando el prefijo /api si viene en la variable
const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const SOCKET_URL = rawUrl.replace(/\/api\/?$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('🔌 Conectado al WebSocket del backend');
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado del WebSocket');
});

export default socket;