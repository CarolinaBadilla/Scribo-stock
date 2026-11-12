// backend/src/services/pagosService.js
const axios = require('axios');
const crypto = require('crypto');
const { pool } = require('../config/db');

const pagosStore = new Map();
let tablaInicializada = false;

const MAP_TABLAS = Object.freeze({
  libro: { tabla: 'libros', col: 'titulo' },
  ropa: { tabla: 'ropa', col: 'nombre' }
});

async function asegurarTablaPagos() {
  if (tablaInicializada) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        venta_id VARCHAR(100) UNIQUE NOT NULL,
        metodo VARCHAR(50) NOT NULL,
        monto NUMERIC NOT NULL,
        estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
        mp_payment_id VARCHAR(100),
        mp_order_id VARCHAR(100),
        detalle JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    tablaInicializada = true;
  } catch {
    // Modo resiliente en memoria si PostgreSQL no está conectado
  }
}

/**
 * 1. MITIGACIÓN DE PRICE TAMPERING:
 * Calcula el total legítimo de la venta directamente desde la base de datos (PostgreSQL),
 * validando precios oficiales por medio de pago y verificando topes de descuento.
 */
async function calcularTotalVerificadoDesdeBD(clientOrPool, items = [], metodo = 'qr', usuario = null) {
  if (!Array.isArray(items) || items.length === 0) {
    return { totalServidor: 0, itemsVerificados: [] };
  }

  const esAdmin = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';
  let totalAcumulado = 0;
  const itemsVerificados = [];

  for (const item of items) {
    const tipo = (item.tipoProducto || item.tipo || '').toLowerCase();
    const prodId = item.productoId || item.id;
    const cantidad = Number(item.cantidad) || 1;
    let descuento = Number(item.descuento) || 0;

    // Validación de tope de descuento por rol
    if (descuento > 50 && !esAdmin) {
      const err = new Error(`El descuento del ${descuento}% requiere autorización de un administrador`);
      err.status = 403;
      throw err;
    }

    const config = MAP_TABLAS[tipo];
    if (!config) {
      const err = new Error(`Tipo de producto inválido: "${tipo}"`);
      err.status = 400;
      throw err;
    }

    // Consulta con parámetro preparado ($1) para evitar SQL Injection
    const resProd = await clientOrPool.query(
      `SELECT ${config.col} AS nombre, precio_efectivo, precio_tarjeta 
       FROM ${config.tabla} 
       WHERE id = $1 AND (activo = TRUE OR activo IS NULL)`,
      [prodId]
    );

    if (resProd.rows.length === 0) {
      const err = new Error(`Producto ${tipo} ID ${prodId} no disponible o dado de baja`);
      err.status = 404;
      throw err;
    }

    const prodDb = resProd.rows[0];
    const precioOficial = metodo === 'efectivo'
      ? Number(prodDb.precio_efectivo)
      : Number(prodDb.precio_tarjeta || prodDb.precio_efectivo);

    const subtotal = precioOficial * cantidad * (1 - descuento / 100);
    totalAcumulado += subtotal;

    itemsVerificados.push({
      title: prodDb.nombre,
      unit_price: precioOficial,
      quantity: cantidad,
      unit_measure: 'unit',
      total_amount: Math.round(subtotal * 100) / 100,
      descuento
    });
  }

  const totalServidor = Math.round(totalAcumulado * 100) / 100;
  return { totalServidor, itemsVerificados };
}

async function guardarPago({ ventaId, metodo, monto, estado, mpPaymentId = null, detalle = null }) {
  const vId = String(ventaId);
  const info = pagosStore.get(vId) || {};
  const updatedInfo = {
    ...info,
    ventaId: vId,
    metodo: metodo || info.metodo || 'desconocido',
    monto: monto !== undefined ? Number(monto) : info.monto,
    estado: estado || info.estado || 'pendiente',
    mpPaymentId: mpPaymentId || info.mpPaymentId || null,
    detalle: detalle || info.detalle || null,
    updatedAt: new Date().toISOString()
  };
  pagosStore.set(vId, updatedInfo);

  try {
    await asegurarTablaPagos();
    await pool.query(
      `INSERT INTO pagos (venta_id, metodo, monto, estado, mp_payment_id, detalle, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (venta_id) DO UPDATE 
       SET estado = EXCLUDED.estado, 
           mp_payment_id = COALESCE(EXCLUDED.mp_payment_id, pagos.mp_payment_id),
           updated_at = NOW();`,
      [vId, updatedInfo.metodo, updatedInfo.monto || 0, updatedInfo.estado, updatedInfo.mpPaymentId, JSON.stringify(updatedInfo.detalle)]
    );
  } catch {
    // Fallback resiliente
  }
  return updatedInfo;
}

async function obtenerEstadoPago(ventaId) {
  const vId = String(ventaId);
  let pago = pagosStore.get(vId);

  if (!pago) {
    try {
      await asegurarTablaPagos();
      const dbRes = await pool.query('SELECT * FROM pagos WHERE venta_id = $1', [vId]);
      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0];
        pago = {
          ventaId: row.venta_id,
          metodo: row.metodo,
          monto: Number(row.monto),
          estado: row.estado,
          mpPaymentId: row.mp_payment_id,
          detalle: row.detalle
        };
        pagosStore.set(vId, pago);
      }
    } catch {
      // Ignorar fallo de conexión
    }
  }

  const estado = pago ? pago.estado : 'pendiente';
  return {
    ventaId: vId,
    pagado: estado === 'aprobado',
    estado,
    detalle: pago || null
  };
}

async function crearOrdenQR({ ventaId, total, items = [], sucursalId, titulo, usuario = null }) {
  const isMock = process.env.MP_MOCK_MODE === 'true';
  const { MP_ACCESS_TOKEN, MP_USER_ID, MP_STORE_ID, MP_POS_ID, API_URL } = process.env;

  // 2. CONTROL DE ACCESO (RBAC/IDOR): Operador restringido a su sucursal
  const esAdmin = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';
  if (!esAdmin && usuario?.sucursalId && sucursalId && Number(usuario.sucursalId) !== Number(sucursalId)) {
    const err = new Error('Acceso denegado: No puedes crear órdenes de cobro para una sucursal distinta a la asignada');
    err.status = 403;
    throw err;
  }

  // 1. MITIGACIÓN DE PRICE TAMPERING: Calcular y validar el total con la base de datos
  let montoFinal = Number(total);
  let itemsParaMP = items;

  if (items.length > 0) {
    try {
      const { totalServidor, itemsVerificados } = await calcularTotalVerificadoDesdeBD(pool, items, 'qr', usuario);
      
      // Si el cliente envió un monto que discrepa del calculado por el servidor, bloqueamos el intento
      if (total !== undefined && Math.abs(Number(total) - totalServidor) > 0.05) {
        const err = new Error(`Discrepancia de precios detectada (Price Tampering): Monto cliente $${total} vs Servidor $${totalServidor}`);
        err.status = 400;
        throw err;
      }
      montoFinal = totalServidor;
      itemsParaMP = itemsVerificados;
    } catch (err) {
      if (err.status) throw err;
      // Si la BD está desconectada en mock mode, continuamos con el monto provisto
    }
  }

  await guardarPago({
    ventaId,
    metodo: 'qr',
    monto: montoFinal,
    estado: 'pendiente',
    detalle: { items: itemsParaMP, sucursalId }
  });

  if (isMock) {
    return {
      success: true,
      mock: true,
      ventaId,
      monto: montoFinal,
      estado: 'pendiente',
      qrData: `00020101021243650016COM.MERCADOLIBRE0129https://mpago.la/pos/${MP_POS_ID || '140722813'}`,
      message: 'Orden QR generada en modo simulación'
    };
  }

  if (!MP_ACCESS_TOKEN || !MP_USER_ID || !MP_STORE_ID || !MP_POS_ID) {
    const err = new Error('Faltan credenciales de Mercado Pago (MP_ACCESS_TOKEN, MP_USER_ID, MP_STORE_ID, MP_POS_ID)');
    err.status = 500;
    throw err;
  }

  const mpPayload = {
    external_reference: String(ventaId),
    title: titulo || `Venta #${ventaId}`,
    description: 'Cobro en Punto de Venta Scribo',
    notification_url: `${API_URL || 'http://localhost:3000'}/api/pagos/webhook/mercadopago`,
    total_amount: montoFinal,
    items: itemsParaMP.map(i => ({
      title: i.title || i.nombre || 'Producto',
      unit_price: Number(i.unit_price || i.precioUnitario || montoFinal),
      quantity: Number(i.quantity || i.cantidad || 1),
      unit_measure: 'unit',
      total_amount: Number(i.total_amount || montoFinal)
    }))
  };

  const mpUrl = `https://api.mercadopago.com/instore/qr/seller/collectors/${MP_USER_ID}/stores/${MP_STORE_ID}/pos/${MP_POS_ID}/orders`;
  const mpResponse = await axios.put(mpUrl, mpPayload, {
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    ventaId,
    monto: montoFinal,
    estado: 'pendiente',
    qrData: mpResponse.data?.qr_data || null,
    orderData: mpResponse.data
  };
}

async function crearIntencionPosnet({ ventaId, monto, items = [], deviceId, usuario = null }) {
  const { MP_ACCESS_TOKEN, MP_POINT_DEVICE_ID, MP_MOCK_MODE } = process.env;
  const targetDevice = deviceId || MP_POINT_DEVICE_ID || 'SIMULATOR_DEVICE_01';
  const isMock = MP_MOCK_MODE === 'true' || targetDevice.startsWith('SIMULATOR');

  let montoFinal = Number(monto);

  // 1. MITIGACIÓN DE PRICE TAMPERING EN POSNET
  if (items.length > 0) {
    try {
      const { totalServidor } = await calcularTotalVerificadoDesdeBD(pool, items, 'posnet', usuario);
      if (monto !== undefined && Math.abs(Number(monto) - totalServidor) > 0.05) {
        const err = new Error(`Discrepancia de precios detectada (Price Tampering): Monto cliente $${monto} vs Servidor $${totalServidor}`);
        err.status = 400;
        throw err;
      }
      montoFinal = totalServidor;
    } catch (err) {
      if (err.status) throw err;
    }
  }

  await guardarPago({
    ventaId,
    metodo: 'posnet',
    monto: montoFinal,
    estado: 'pendiente',
    detalle: { deviceId: targetDevice }
  });

  if (isMock) {
    const mockIntentId = `mock_intent_${Date.now()}`;
    await guardarPago({ ventaId, estado: 'pendiente', mpPaymentId: mockIntentId, monto: montoFinal });
    return {
      success: true,
      mock: true,
      ventaId,
      monto: montoFinal,
      paymentIntentId: mockIntentId,
      deviceId: targetDevice,
      estado: 'pendiente',
      status: 'OPEN',
      message: 'Intención de cobro enviada a la terminal (Modo Simulación activo)'
    };
  }

  if (!MP_ACCESS_TOKEN) {
    const err = new Error('Falta la credencial MP_ACCESS_TOKEN en el servidor');
    err.status = 500;
    throw err;
  }

  const url = `https://api.mercadopago.com/point/integration-api/devices/${targetDevice}/payment-intents`;
  const mpResponse = await axios.post(
    url,
    {
      amount: Math.round(Number(montoFinal)),
      additional_info: {
        external_reference: String(ventaId),
        print_on_terminal: true
      }
    },
    {
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const intentId = mpResponse.data?.id;
  await guardarPago({ ventaId, estado: 'pendiente', mpPaymentId: intentId, monto: montoFinal });

  return {
    success: true,
    ventaId,
    monto: montoFinal,
    paymentIntentId: intentId,
    deviceId: targetDevice,
    estado: 'pendiente',
    deviceData: mpResponse.data
  };
}

async function simularPosnet({ ventaId, accion }) {
  const nuevoEstado = accion === 'rechazar' ? 'rechazado' : 'aprobado';
  const pagoActualizado = await guardarPago({ ventaId, estado: nuevoEstado });
  return { success: true, ventaId, estado: nuevoEstado, pago: pagoActualizado };
}

/**
 * 3. VALIDACIÓN CRIPTOGRÁFICA DE WEBHOOKS DE MERCADO PAGO:
 * Valida la autenticidad de la firma HMAC-SHA256 (x-signature y x-request-id)
 * para evitar inyecciones de notificaciones falsas en producción.
 */
function validarFirmaWebhookMP({ headers, query, body }) {
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  const isMock = process.env.MP_MOCK_MODE === 'true';

  // Si está en modo mock o no se ha configurado secret en desarrollo, se permite con advertencia
  if (isMock || !webhookSecret) {
    return { valido: true, mock: true };
  }

  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];
  const dataId = query['data.id'] || query.id || body?.data?.id || body?.id;

  if (!xSignature || !xRequestId || !dataId) {
    return { valido: false, razon: 'Faltan cabeceras de firma requeridas por Mercado Pago (x-signature / x-request-id)' };
  }

  // Parsear ts y v1 del header x-signature (ej: ts=1704067200,v1=abcdef...)
  const parts = xSignature.split(',').reduce((acc, part) => {
    const [key, val] = part.trim().split('=');
    if (key && val) acc[key] = val;
    return acc;
  }, {});

  const { ts, v1 } = parts;
  if (!ts || !v1) {
    return { valido: false, razon: 'Estructura de x-signature no válida' };
  }

  // Protección contra Replay Attacks: tolerancia máxima de 10 minutos (600 segundos)
  const tsSegundos = parseInt(ts, 10);
  const ahoraSegundos = Math.floor(Date.now() / 1000);
  if (Math.abs(ahoraSegundos - tsSegundos) > 600) {
    return { valido: false, razon: 'Timestamp del webhook expirado (posible Replay Attack)' };
  }

  // Manifiesto estándar de Mercado Pago: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

  // Comparación en tiempo constante para mitigar Timing Attacks
  try {
    const bufHmac = Buffer.from(hmac);
    const bufV1 = Buffer.from(v1);
    const firmaValida = bufHmac.length === bufV1.length && crypto.timingSafeEqual(bufHmac, bufV1);
    return { valido: firmaValida, razon: firmaValida ? null : 'Firma criptográfica inválida' };
  } catch {
    return { valido: false, razon: 'Error al comparar firmas' };
  }
}

/**
 * 3. PROCESAMIENTO IDEMPOTENTE DEL WEBHOOK:
 * Garantiza que notificaciones duplicadas no causen re-procesamiento ni inconsistencias.
 */
async function procesarWebhook({ headers = {}, body = {}, query = {} }) {
  // 1. Verificación de firma criptográfica
  const verificacion = validarFirmaWebhookMP({ headers, query, body });
  if (!verificacion.valido) {
    const err = new Error(`Firma de Webhook no válida: ${verificacion.razon}`);
    err.status = 401;
    throw err;
  }

  // 2. Notificación directa simulada (Dev/Test)
  if (body?.ventaId && body?.status) {
    const vId = String(body.ventaId);
    const nuevoEstado = body.status === 'approved' || body.status === 'aprobado' ? 'aprobado' : 'rechazado';
    
    // Idempotencia: si ya está en ese estado, no re-procesar
    const estadoActual = await obtenerEstadoPago(vId);
    if (estadoActual.estado === nuevoEstado) {
      return { procesado: true, yaProcesado: true, estado: nuevoEstado };
    }

    await guardarPago({ ventaId: vId, estado: nuevoEstado });
    return { procesado: true, ventaId: vId, estado: nuevoEstado };
  }

  // 3. Notificación oficial de Mercado Pago
  const paymentId = query['data.id'] || query.id || body?.data?.id || body?.id;
  if (!paymentId || !process.env.MP_ACCESS_TOKEN) {
    return { procesado: false };
  }

  const mpRes = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
  });

  const paymentData = mpRes.data;
  const ventaId = paymentData?.external_reference;
  const status = paymentData?.status;

  if (ventaId) {
    const nuevoEstado = status === 'approved' ? 'aprobado' : status;
    const estadoActual = await obtenerEstadoPago(ventaId);

    // Idempotencia estricta: si ya fue aprobado, descartar duplicados
    if (estadoActual.estado === 'aprobado') {
      return { procesado: true, yaProcesado: true, ventaId, estado: 'aprobado' };
    }

    await guardarPago({
      ventaId: String(ventaId),
      estado: nuevoEstado,
      mpPaymentId: String(paymentId)
    });
    return { procesado: true, ventaId, estado: nuevoEstado, paymentId };
  }

  return { procesado: false };
}

module.exports = {
  guardarPago,
  obtenerEstadoPago,
  crearOrdenQR,
  crearIntencionPosnet,
  simularPosnet,
  validarFirmaWebhookMP,
  procesarWebhook
};
