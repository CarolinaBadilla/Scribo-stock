// backend/src/routes/productos.js
const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { crearProductoSchema } = require('../schemas/productosSchema');

// Buscar requiere sesión activa
router.get('/buscar', verificarToken, productosController.buscarProductoPorCodigo);

// Crear producto: Token -> Rol -> Validación Zod -> Controlador
router.post(
  '/', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  validar(crearProductoSchema), 
  productosController.crearProducto
);

// Modificar producto (admite actualización parcial)
router.put(
  '/:tipo/:id', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  validar(crearProductoSchema.partial()), 
  productosController.actualizarProducto
);

// Eliminar producto
router.delete(
  '/:tipo/:id', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  productosController.eliminarProducto
);

module.exports = router;