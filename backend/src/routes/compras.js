const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/comprasController');

router.post('/registrar', comprasController.registrarCompra);

module.exports = router;