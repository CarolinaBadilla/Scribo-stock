// frontend/src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
});

socket.on('connect', () => {
  console.log('🔌 Conectado al servidor WebSocket');
});

socket.on('disconnect', () => {
  console.log('🔌 Desconectado del servidor WebSocket');
});

export default socket;