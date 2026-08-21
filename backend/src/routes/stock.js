const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/por-sucursal/:id', stockController.obtenerStockPorSucursal);
router.post('/agregar', stockController.agregarStock);

module.exports = router;