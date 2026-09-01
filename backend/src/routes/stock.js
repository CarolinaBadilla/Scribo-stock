const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/por-sucursal/:id', stockController.obtenerStockPorSucursal);
router.get('/alertas', stockController.obtenerAlertasStockBajo);

module.exports = router;