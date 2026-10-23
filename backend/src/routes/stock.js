const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { verificarToken } = require('../middleware/auth');
const { restringirSucursal } = require('../middleware/sucursal');

router.use(verificarToken);

router.get('/por-sucursal/:sucursalId', verificarToken, restringirSucursal, stockController.obtenerStockPorSucursal);
router.get('/alertas', stockController.obtenerAlertasStockBajo);

module.exports = router;