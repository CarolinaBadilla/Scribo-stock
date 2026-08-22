const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');

router.get('/buscar', productosController.buscarProductoPorCodigo);
router.post('/', productosController.crearProducto);

module.exports = router;