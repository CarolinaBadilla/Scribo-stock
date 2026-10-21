const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');
const { verificarToken, permitirRoles } = require('../middleware/auth');

// Listar sucursales requiere estar logueado
router.get('/', verificarToken, sucursalesController.obtenerSucursales);
router.get('/:id', verificarToken, sucursalesController.obtenerSucursalPorId);

// Modificaciones solo para rol jerárquico
router.post('/', verificarToken, permitirRoles('jefe', 'DUENO'), sucursalesController.crearSucursal);
router.put('/:id', verificarToken, permitirRoles('jefe', 'DUENO'), sucursalesController.actualizarSucursal);

module.exports = router;