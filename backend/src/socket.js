// backend/src/socket.js
const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', process.env.FRONTEND_URL],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);

    socket.on('disconnect', () => {
      console.log('🔌 Cliente desconectado:', socket.id);
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