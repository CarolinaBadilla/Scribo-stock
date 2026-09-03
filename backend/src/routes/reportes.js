const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');

// Endpoints de reportes usando PostgreSQL directo
router.get('/ventas', reportesController.obtenerVentas);
router.get('/compras', reportesController.obtenerCompras);
router.get('/stock-actual', reportesController.obtenerStockActual);
router.get('/movimientos', reportesController.obtenerMovimientos);
router.get('/estadisticas', reportesController.obtenerEstadisticas);

module.exports = router;