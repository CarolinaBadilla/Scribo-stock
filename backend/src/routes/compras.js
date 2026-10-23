const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/comprasController');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { registrarCompraSchema } = require('../schemas/comprasSchema');

// 🔒 Exigir token y rol
router.post('/registrar', verificarToken, validar(registrarCompraSchema), permitirRoles('jefe', 'DUENO'), comprasController.registrarCompra);

module.exports = router;