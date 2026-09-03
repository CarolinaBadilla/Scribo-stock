const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');

router.get('/buscar', productosController.buscarProductoPorCodigo);
router.post('/', productosController.crearProducto);
router.put('/:tipo/:id', productosController.actualizarProducto); 
router.delete('/:tipo/:id', productosController.eliminarProducto);

module.exports = router;