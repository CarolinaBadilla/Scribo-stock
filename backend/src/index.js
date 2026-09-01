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
app.set('trust proxy', 1);

// 3. Middlewares de Seguridad y Red
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Orígenes exactos permitidos (Producción y Entorno Local)
const allowedOrigins = [
  'https://scribo.com.ar',
  'https://www.scribo.com.ar',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8082'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (ej: curl, Postman o llamadas internas) o listadas
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('⚠️ Origen no listado pero permitido por fallback:', origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

// Habilitar CORS globalmente y responder a peticiones de preflight (OPTIONS)
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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

app.use('/api/autenticacion', autenticacionRoutes);
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/estadisticas', reportesRoutes);

// 6. Rutas de diagnóstico
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend funcionando con PostgreSQL', cors: 'habilitado' });
});

app.get('/', (req, res) => {
  res.json({ message: 'API de Librería Stock funcionando correctamente' });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔌 WebSocket habilitado`);
});