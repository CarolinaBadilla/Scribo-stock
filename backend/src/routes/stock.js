const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/por-sucursal/:sucursalId', verificarToken, stockController.obtenerStockPorSucursal);
router.get('/alertas', stockController.obtenerAlertasStockBajo);

module.exports = router;