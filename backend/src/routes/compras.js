const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/comprasController');
const { verificarToken, permitirRoles } = require('../middleware/auth');

// 🔒 Exigir token y rol
router.post('/registrar', verificarToken, permitirRoles('jefe', 'DUENO'), comprasController.registrarCompra);

module.exports = router;