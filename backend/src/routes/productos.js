const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');

const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.get('/buscar', verificarToken, productosController.buscarProductoPorCodigo);
router.post('/', verificarToken, permitirRoles('jefe', 'DUENO'), productosController.crearProducto);
router.put('/:tipo/:id', verificarToken, permitirRoles('jefe', 'DUENO'), productosController.actualizarProducto); 
router.delete('/:tipo/:id', verificarToken, permitirRoles('jefe', 'DUENO'), productosController.eliminarProducto);

module.exports = router;