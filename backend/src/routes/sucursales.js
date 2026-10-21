const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');
const { permitirRoles } = require('../middleware/auth');

router.get('/', sucursalesController.obtenerSucursales);
router.get('/:id', sucursalesController.obtenerSucursalPorId);
router.post('/', permitirRoles('jefe', 'DUENO'), sucursalesController.crearSucursal);
router.put('/:id', permitirRoles('jefe', 'DUENO'), sucursalesController.actualizarSucursal);

module.exports = router;