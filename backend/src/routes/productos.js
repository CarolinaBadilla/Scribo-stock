// backend/src/routes/productos.js
const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productosController');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { crearProductoSchema, actualizarPreciosMasivoSchema, actualizarPreciosLoteSchema } = require('../schemas/productosSchema');

// Búsqueda rápida para caja y lector de balanza / códigos de barras
router.get('/buscar', verificarToken, productosController.buscarProductoPorCodigo);

// Actualización masiva de precios por porcentaje y redondeo
router.post(
  '/actualizar-precios-masivo',
  verificarToken,
  permitirRoles('jefe', 'DUENO'),
  validar(actualizarPreciosMasivoSchema),
  productosController.actualizarPreciosMasivo
);

// Actualización de precios en lote / edición manual rápida
router.put(
  '/precios-lote',
  verificarToken,
  permitirRoles('jefe', 'DUENO'),
  validar(actualizarPreciosLoteSchema),
  productosController.actualizarPreciosLote
);

// Catálogo unificado multi-tenant
router.get('/', verificarToken, productosController.obtenerProductos);
router.get('/:id', verificarToken, productosController.obtenerProductoPorId);

// Crear producto unificado
router.post(
  '/', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  validar(crearProductoSchema), 
  productosController.crearProducto
);

// Modificar producto unificado (soporta /:id y ruta legacy /:tipo/:id)
router.put(
  '/:id', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  validar(crearProductoSchema.partial()), 
  productosController.actualizarProducto
);
router.put(
  '/:tipo/:id', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  validar(crearProductoSchema.partial()), 
  productosController.actualizarProducto
);

// Baja lógica de producto (soporta /:id y ruta legacy /:tipo/:id)
router.delete(
  '/:id', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  productosController.eliminarProducto
);
router.delete(
  '/:tipo/:id', 
  verificarToken, 
  permitirRoles('jefe', 'DUENO'), 
  productosController.eliminarProducto
);

module.exports = router;
