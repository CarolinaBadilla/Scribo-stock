// src/index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const sucursalesRoutes = require('./routes/sucursales');
const stockRoutes = require('./routes/stock');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const comprasRoutes = require('./routes/compras');
const reportesRoutes = require('./routes/reportes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar CORS para permitir el frontend
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://libreria-stock-frontend.onrender.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Rutas
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/reportes', reportesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend funcionando' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});