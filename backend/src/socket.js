// backend/src/socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initSocket(server) {
  const allowedOrigins = [
    'https://web.scribo.com.ar',
    'https://www.web.scribo.com.ar'
  ];
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:5173');
  }

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  // 🔒 Middleware de autenticación en el Handshake del WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Autenticación requerida para conectar al WebSocket'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
      });
      socket.usuario = decoded; // Se asocia el usuario validado a la sesión del socket
      next();
    } catch (err) {
      return next(new Error('Token de WebSocket inválido o expirado'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente autenticado conectado: ${socket.usuario.usuario} (${socket.id})`);

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

function emitStockUpdate(data) {
  if (io) {
    io.emit('stock-update', data);
  }
}

function emitVentaRegistrada(data) {
  if (io) {
    io.emit('venta-registrada', data);
  }
}

module.exports = { initSocket, emitStockUpdate, emitVentaRegistrada };