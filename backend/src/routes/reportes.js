const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verificarToken, permitirRoles } = require('../middleware/auth');

// 🔒 Todas las rutas de este archivo quedan protegidas automáticamente
router.use(verificarToken);

// Endpoints de reportes
router.get('/ventas', reportesController.obtenerVentas);
router.get('/compras', permitirRoles('jefe', 'DUENO'), reportesController.obtenerCompras);
router.get('/stock-actual', reportesController.obtenerStockActual);
router.get('/movimientos', reportesController.obtenerMovimientos);
router.get('/estadisticas', permitirRoles('jefe', 'DUENO'), reportesController.obtenerEstadisticas);

module.exports = router;