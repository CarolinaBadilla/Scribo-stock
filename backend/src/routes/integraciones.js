// backend/src/routes/integraciones.js
const express = require('express');
const router = express.Router();
const integracionesController = require('../controllers/integracionesController');
const { verificarToken, permitirRoles } = require('../middleware/auth');

// Todas las rutas de configuración de integraciones requieren token y rol administrativo
router.use(verificarToken);
router.use(permitirRoles('admin', 'jefe', 'DUENO'));

// Consulta estado de integraciones del comercio
router.get('/', integracionesController.obtenerIntegraciones);

// Vincular / actualizar Access Token de Mercado Pago
router.post('/mercadopago', integracionesController.guardarCredencialesMercadoPago);

// Generar o refrescar QR Único de Mostrador por sucursal
router.post('/mercadopago/generar-qr/:sucursalId', integracionesController.generarQRSucursal);

// Configuración y carga de certificados de AFIP / ARCA
router.post('/afip', integracionesController.guardarConfiguracionAfip);

// Probar conexión y autenticación con AFIP / ARCA
router.post('/afip/probar-conexion', integracionesController.probarConexionAfip);

module.exports = router;
