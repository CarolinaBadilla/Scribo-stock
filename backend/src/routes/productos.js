const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');

router.get('/buscar', productosController.buscarProductoPorCodigo);
router.post('/', productosController.crearProducto);
router.put('/:tipo/:id', productosController.actualizarProducto); // 👈 Agregamos esta ruta

module.exports = router;