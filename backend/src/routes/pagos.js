// backend/src/routes/pagos.js
const express = require('express');
const { verificarToken } = require('../middleware/auth');
const pagosService = require('../services/pagosService');

const router = express.Router();

// Aislamiento: bloquea todas las rutas si el módulo no está activo
router.use((req, res, next) => {
  if (process.env.ENABLE_PAYMENTS_MODULE !== 'true') {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  next();
});

router.post('/mercadopago/qr', verificarToken, async (req, res) => {
  try {
    const { ventaId, total, items = [], sucursalId, titulo } = req.body;
    if (!ventaId) {
      return res.status(400).json({ error: 'Falta parámetro requerido: ventaId' });
    }
    const resultado = await pagosService.crearOrdenQR({ 
      ventaId, 
      total, 
      items, 
      sucursalId, 
      titulo,
      usuario: req.usuario 
    });
    return res.json(resultado);
  } catch (error) {
    const status = error.status || 502;
    const mensaje = process.env.NODE_ENV === 'production' && status >= 500
      ? 'Error de comunicación con el servicio de pagos'
      : error.message;
    return res.status(status).json({ error: mensaje });
  }
});

router.post('/posnet/cobrar', verificarToken, async (req, res) => {
  try {
    const { ventaId, monto, items = [], deviceId } = req.body;
    if (!ventaId) {
      return res.status(400).json({ error: 'Falta parámetro requerido: ventaId' });
    }
    const resultado = await pagosService.crearIntencionPosnet({ 
      ventaId, 
      monto, 
      items, 
      deviceId,
      usuario: req.usuario 
    });
    return res.json(resultado);
  } catch (error) {
    const status = error.status || 502;
    const mensaje = process.env.NODE_ENV === 'production' && status >= 500
      ? 'Error al comunicarse con la terminal Posnet/Point'
      : error.message;
    return res.status(status).json({ error: mensaje });
  }
});

router.post('/posnet/simular', verificarToken, async (req, res) => {
  try {
    const { ventaId, accion } = req.body;
    if (!ventaId) {
      return res.status(400).json({ error: 'Falta el parámetro ventaId' });
    }
    const resultado = await pagosService.simularPosnet({ ventaId, accion });
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: 'Error en simulación' });
  }
});

router.post('/webhook/mercadopago', async (req, res) => {
  try {
    const resultado = await pagosService.procesarWebhook({ 
      headers: req.headers, 
      body: req.body, 
      query: req.query 
    });
    return res.status(200).json({ received: true, ...resultado });
  } catch (error) {
    // Si la firma es inválida, se rechaza la petición con 401
    const status = error.status || 400;
    return res.status(status).json({ error: error.message });
  }
});

router.get('/estado/:ventaId', verificarToken, async (req, res) => {
  try {
    const resultado = await pagosService.obtenerEstadoPago(req.params.ventaId);
    return res.json(resultado);
  } catch {
    return res.status(500).json({ error: 'Error al consultar estado de pago' });
  }
});

module.exports = router;
