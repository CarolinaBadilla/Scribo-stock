const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');

router.get('/', sucursalesController.obtenerSucursales);
router.get('/:id', sucursalesController.obtenerSucursalPorId);
router.post('/', sucursalesController.crearSucursal);
router.put('/:id', sucursalesController.actualizarSucursal);

module.exports = router;