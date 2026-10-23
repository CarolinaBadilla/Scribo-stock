const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initSocket } = require('./socket');

// 1. Cargar variables de entorno
dotenv.config();

// 2. Inicializar App y Servidor HTTP
const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
initSocket(server);

// Confiar en Nginx Proxy Manager para obtener la IP real del cliente
app.set('trust proxy', 2);

// 3. Middlewares de Seguridad y Red
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// 1. Orígenes permitidos dinámicos según el entorno
const allowedOrigins = [
  'https://scribo.com.ar',
  'https://www.scribo.com.ar'
];

// Solo agregamos localhost si estamos en desarrollo local
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}

// Si configuraste una variable FRONTEND_URL en .env, la sumamos a la lista
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir herramientas como curl/Postman o llamadas server-to-server (sin header Origin)
    if (!origin) {
      return callback(null, true);
    }

    // Comprobar si el origen exacto está en la lista blanca
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 🔒 Bloquear explícitamente cualquier otro origen
    console.warn(`⛔ Intento de acceso bloqueado por CORS desde el origen: ${origin}`);
    return callback(new Error('Acceso no permitido por la política CORS del servidor'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones desde esta IP, intente más tarde.' }
});

app.use('/api/', limiter);
app.use(express.json());

// 4. Logging de requests (Debug)
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// 5. Rutas de la API
const sucursalesRoutes = require('./routes/sucursales');
const stockRoutes = require('./routes/stock');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const comprasRoutes = require('./routes/compras');
const reportesRoutes = require('./routes/reportes');
const autenticacionRoutes = require('./routes/autenticacion');
const reportesController = require('./controllers/reportesController');
const { verificarToken, permitirRoles } = require('./middleware/auth');

// 6. Rutas públicas
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});
app.use('/api/autenticacion', autenticacionRoutes);

// 7. Todo lo que sigue exige token
app.use('/api', verificarToken);

app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/reportes', reportesRoutes);
app.get('/api/estadisticas', verificarToken, permitirRoles('jefe', 'DUENO'), reportesController.obtenerEstadisticas);

app.get('/', (req, res) => {
  res.json({ message: 'API de Librería Stock funcionando correctamente' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware Global de Errores: captura cualquier fallo no controlado
app.use((err, req, res, next) => {
  // Registra el error completo en el log privado del servidor
  console.error('❌ Error no controlado detectado:', err);

  // Respuesta genérica y limpia hacia el cliente
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Ocurrió un error interno en el servidor' 
      : err.message
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔌 WebSocket habilitado`);
});