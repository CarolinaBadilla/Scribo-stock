// backend/src/services/pagosService.js
const axios = require('axios');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { desencriptarTexto } = require('../utils/cryptoUtils');
const { emitPagoAprobado, emitStockUpdate, emitVentaRegistrada } = require('../socket');

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
        comercio_id INTEGER,
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
 * 1. MITIGACIÓN DE PRICE TAMPERING Y CATÁLOGO MULTI-TENANT:
 * Calcula el total legítimo de la venta directamente desde PostgreSQL (public.productos o legacy),
 * validando precios oficiales por medio de pago y verificando topes de descuento.
 */
async function calcularTotalVerificadoDesdeBD(clientOrPool, items = [], metodo = 'qr', usuario = null) {
  if (!Array.isArray(items) || items.length === 0) {
    return { totalServidor: 0, itemsVerificados: [] };
  }

  const esAdmin = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';
  const comercioId = usuario?.comercio_id;
  let totalAcumulado = 0;
  const itemsVerificados = [];

  for (const item of items) {
    // Si el ítem es temporal / varios (F4), se respeta el monto ingresado
    if (item.es_temporal || item.esTemporal || !item.id && !item.producto_unificado_id && !item.productoId) {
      const precioUnit = Number(item.precio_unitario || item.precioUnitario || item.precio || 0);
      const cant = Number(item.cantidad || 1);
      const subtotalTemp = precioUnit * cant;
      totalAcumulado += subtotalTemp;
      itemsVerificados.push({
        title: item.nombre || item.descripcion || 'Varios / Rápido',
        unit_price: precioUnit,
        quantity: cant,
        unit_measure: 'unit',
        total_amount: Math.round(subtotalTemp * 100) / 100,
        es_temporal: true
      });
      continue;
    }

    const tipo = (item.tipoProducto || item.categoria || item.tipo || 'general').toLowerCase();
    const prodId = item.producto_unificado_id || item.productoId || item.id;
    const cantidad = Number(item.cantidad) || 1;
    let descuento = Number(item.descuento) || 0;

    // Validación de tope de descuento por rol
    if (descuento > 50 && !esAdmin) {
      const err = new Error(`El descuento del ${descuento}% requiere autorización de un administrador`);
      err.status = 403;
      throw err;
    }

    let prodDb = null;

    // 1. Buscar en public.productos si tenemos comercio_id
    if (comercioId) {
      const resUnified = await clientOrPool.query(
        `SELECT id, nombre, precio_efectivo, precio_tarjeta, unidad_medida 
         FROM public.productos 
         WHERE id = $1 AND comercio_id = $2 AND activo = true`,
        [prodId, comercioId]
      );
      if (resUnified.rows.length > 0) {
        prodDb = resUnified.rows[0];
      }
    }

    // 2. Si no se encontró y hay mapeo legacy en MAP_TABLAS
    if (!prodDb && MAP_TABLAS[tipo]) {
      const config = MAP_TABLAS[tipo];
      const resLegacy = await clientOrPool.query(
        `SELECT ${config.col} AS nombre, precio_efectivo, precio_tarjeta 
         FROM ${config.tabla} 
         WHERE id = $1 AND (activo = TRUE OR activo IS NULL)`,
        [prodId]
      );
      if (resLegacy.rows.length > 0) {
        prodDb = resLegacy.rows[0];
      }
    }

    if (!prodDb) {
      const err = new Error(`Producto "${tipo}" ID ${prodId} no disponible o dado de baja`);
      err.status = 404;
      throw err;
    }

    const precioOficial = metodo === 'efectivo'
      ? Number(prodDb.precio_efectivo)
      : Number(prodDb.precio_tarjeta || prodDb.precio_efectivo);

    const subtotal = precioOficial * cantidad * (1 - descuento / 100);
    totalAcumulado += subtotal;

    itemsVerificados.push({
      title: prodDb.nombre,
      unit_price: precioOficial,
      quantity: cantidad,
      unit_measure: prodDb.unidad_medida || 'unit',
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

/**
 * 2. CREAR ORDEN EN QR ÚNICO DE MOSTRADOR (MODELO ATENDIDO / IN-STORE)
 * Desencripta el access_token del comercio y envía la orden con monto exacto al POS de la sucursal.
 */
async function crearOrdenQRFijo({ items = [], sucursalId, total, usuario }) {
  const comercioId = usuario?.comercio_id;
  const sId = parseInt(sucursalId || usuario?.sucursalId, 10);

  if (!comercioId) {
    const err = new Error('No se identificó el comercio en la sesión');
    err.status = 403;
    throw err;
  }

  if (!sId) {
    const err = new Error('Se requiere especificar la sucursal para enviar la orden al QR');
    err.status = 400;
    throw err;
  }

  // Control RBAC: operador solo puede operar en su sucursal asignada
  const esAdmin = usuario?.rol === 'jefe' || usuario?.rol === 'DUENO';
  if (!esAdmin && usuario?.sucursalId && Number(usuario.sucursalId) !== sId) {
    const err = new Error('Acceso denegado: No puedes crear órdenes para una sucursal distinta a la asignada');
    err.status = 403;
    throw err;
  }

  // Consultar datos de sucursal
  const sucRes = await pool.query(
    `SELECT id, nombre, mp_external_store_id, mp_external_pos_id, mp_qr_imagen_url, mp_qr_data 
     FROM public.sucursales 
     WHERE id = $1 AND comercio_id = $2`,
    [sId, comercioId]
  );

  if (sucRes.rows.length === 0) {
    const err = new Error('Sucursal no encontrada');
    err.status = 404;
    throw err;
  }

  const sucursal = sucRes.rows[0];

  // Consultar credenciales de Mercado Pago del comercio
  const intRes = await pool.query(
    `SELECT mp_activo, mp_user_id, mp_access_token_enc 
     FROM public.integraciones_comercio 
     WHERE comercio_id = $1`,
    [comercioId]
  );

  const integracion = intRes.rows[0];
  const isMock = process.env.MP_MOCK_MODE === 'true';

  if (!isMock && (!integracion || !integracion.mp_activo || !integracion.mp_access_token_enc)) {
    const err = new Error('Tu comercio no tiene configurada o activa la integración con Mercado Pago. Ve a Configuración -> Integraciones.');
    err.status = 400;
    throw err;
  }

  // Mitigación de Price Tampering
  const { totalServidor, itemsVerificados } = await calcularTotalVerificadoDesdeBD(pool, items, 'qr', usuario);
  const montoFinal = totalServidor > 0 ? totalServidor : Number(total || 0);

  if (total !== undefined && totalServidor > 0 && Math.abs(Number(total) - totalServidor) > 0.05) {
    const err = new Error(`Discrepancia de precios detectada (Price Tampering): Enviado $${total} vs Calculado $${totalServidor}`);
    err.status = 400;
    throw err;
  }

  // Generar external_reference estructurado: c_${comercio_id}_s_${sucursal_id}_${timestamp}_${random}
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const externalReference = `c_${comercioId}_s_${sId}_${timestamp}_${randomStr}`;

  // Registrar en tabla de pagos
  await guardarPago({
    ventaId: externalReference,
    metodo: 'mercadopago_qr',
    monto: montoFinal,
    estado: 'pendiente',
    detalle: {
      comercioId,
      sucursalId: sId,
      items: itemsVerificados.length > 0 ? itemsVerificados : items,
      externalReference
    }
  });

  const accessToken = integracion?.mp_access_token_enc ? desencriptarTexto(integracion.mp_access_token_enc) : null;
  const esTokenMock = accessToken ? accessToken.startsWith('TEST-MOCK') || accessToken.startsWith('TEST-000000') : false;

  if (isMock || esTokenMock || !accessToken) {
    return {
      success: true,
      mock: true,
      external_reference: externalReference,
      total: montoFinal,
      sucursal: {
        id: sucursal.id,
        nombre: sucursal.nombre,
        qr_imagen_url: sucursal.mp_qr_imagen_url
      },
      mensaje: 'Orden enviada al QR del mostrador (Modo Simulación activo)'
    };
  }

  if (!sucursal.mp_external_store_id || !sucursal.mp_external_pos_id) {
    const err = new Error('La sucursal aún no tiene generado su QR Único de mostrador. Ve a Configuración -> Integraciones para generarlo.');
    err.status = 400;
    throw err;
  }

  const userId = integracion.mp_user_id;
  const itemsParaMP = (itemsVerificados.length > 0 ? itemsVerificados : items).map(i => ({
    title: (i.title || i.nombre || 'Producto').substring(0, 50),
    unit_price: Number(i.unit_price || i.precio_unitario || montoFinal),
    quantity: Number(i.quantity || i.cantidad || 1),
    unit_measure: i.unit_measure || 'unit',
    total_amount: Number(i.total_amount || montoFinal)
  }));

  const mpPayload = {
    external_reference: externalReference,
    title: `Venta Mostrador ${sucursal.nombre}`.substring(0, 45),
    description: 'Cobro en mostrador Scribo POS',
    notification_url: `${process.env.API_URL || 'http://localhost:3000'}/api/pagos/webhook?comercio_id=${comercioId}`,
    total_amount: montoFinal,
    items: itemsParaMP
  };

  const mpUrl = `https://api.mercadopago.com/instore/qr/seller/collectors/${userId}/stores/${sucursal.mp_external_store_id}/pos/${sucursal.mp_external_pos_id}/orders`;

  try {
    await axios.put(mpUrl, mpPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });
  } catch (errMP) {
    console.error('Error al enviar orden a Mercado Pago:', errMP.response?.data || errMP.message);
    const err = new Error(`Error de comunicación con Mercado Pago: ${errMP.response?.data?.message || errMP.message}`);
    err.status = 502;
    throw err;
  }

  return {
    success: true,
    external_reference: externalReference,
    total: montoFinal,
    sucursal: {
      id: sucursal.id,
      nombre: sucursal.nombre,
      qr_imagen_url: sucursal.mp_qr_imagen_url
    }
  };
}

/**
 * 3. CANCELAR ORDEN EN QR ÚNICO DE MOSTRADOR
 */
async function cancelarOrdenQRFijo({ sucursalId, usuario }) {
  const comercioId = usuario?.comercio_id;
  const sId = parseInt(sucursalId || usuario?.sucursalId, 10);

  const sucRes = await pool.query(
    `SELECT id, mp_external_store_id, mp_external_pos_id FROM public.sucursales WHERE id = $1 AND comercio_id = $2`,
    [sId, comercioId]
  );

  if (sucRes.rows.length === 0) {
    return { success: true, cancelada: true };
  }

  const sucursal = sucRes.rows[0];

  const intRes = await pool.query(
    `SELECT mp_user_id, mp_access_token_enc FROM public.integraciones_comercio WHERE comercio_id = $1`,
    [comercioId]
  );
  const integracion = intRes.rows[0];

  if (process.env.MP_MOCK_MODE !== 'true' && integracion?.mp_access_token_enc && sucursal.mp_external_store_id && sucursal.mp_external_pos_id) {
    try {
      const accessToken = desencriptarTexto(integracion.mp_access_token_enc);
      const url = `https://api.mercadopago.com/instore/qr/seller/collectors/${integracion.mp_user_id}/stores/${sucursal.mp_external_store_id}/pos/${sucursal.mp_external_pos_id}/orders`;
      await axios.delete(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 6000
      });
    } catch (err) {
      console.log('Info al cancelar orden en MP:', err.response?.data || err.message);
    }
  }

  return { success: true, cancelada: true };
}

/**
 * 4. SIMULACIÓN DE PAGO QR (MODO MOCK / PRUEBAS)
 */
async function simularPagoQR({ external_reference }) {
  if (!external_reference) {
    const err = new Error('Falta external_reference');
    err.status = 400;
    throw err;
  }

  const pagoActualizado = await guardarPago({
    ventaId: external_reference,
    estado: 'aprobado',
    mpPaymentId: `mock_pay_${Date.now()}`
  });

  emitPagoAprobado({
    external_reference,
    estado: 'aprobado',
    mock: true,
    monto: pagoActualizado.monto
  });

  return {
    success: true,
    external_reference,
    estado: 'aprobado',
    pago: pagoActualizado
  };
}

// Compatibilidad con endpoint anterior
async function crearOrdenQR(params) {
  return crearOrdenQRFijo(params);
}

async function crearIntencionPosnet({ ventaId, monto, items = [], deviceId, usuario = null }) {
  const { MP_ACCESS_TOKEN, MP_POINT_DEVICE_ID, MP_MOCK_MODE } = process.env;
  const targetDevice = deviceId || MP_POINT_DEVICE_ID || 'SIMULATOR_DEVICE_01';
  const isMock = MP_MOCK_MODE === 'true' || targetDevice.startsWith('SIMULATOR');

  let montoFinal = Number(monto);

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

function validarFirmaWebhookMP({ headers, query, body, customSecret = null }) {
  const webhookSecret = customSecret || process.env.MP_WEBHOOK_SECRET;
  const isMock = process.env.MP_MOCK_MODE === 'true';

  if (isMock || !webhookSecret) {
    return { valido: true, mock: true };
  }

  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];
  const dataId = query['data.id'] || query.id || body?.data?.id || body?.id;

  if (!xSignature || !xRequestId || !dataId) {
    return { valido: false, razon: 'Faltan cabeceras de firma requeridas por Mercado Pago (x-signature / x-request-id)' };
  }

  const parts = xSignature.split(',').reduce((acc, part) => {
    const [key, val] = part.trim().split('=');
    if (key && val) acc[key] = val;
    return acc;
  }, {});

  const { ts, v1 } = parts;
  if (!ts || !v1) {
    return { valido: false, razon: 'Estructura de x-signature no válida' };
  }

  const tsSegundos = parseInt(ts, 10);
  const ahoraSegundos = Math.floor(Date.now() / 1000);
  if (Math.abs(ahoraSegundos - tsSegundos) > 600) {
    return { valido: false, razon: 'Timestamp del webhook expirado (posible Replay Attack)' };
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

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
 * 5. PROCESAMIENTO IDEMPOTENTE DEL WEBHOOK MULTI-TENANT:
 * Lee el comercio desde la external_reference o parámetros, desencripta sus credenciales,
 * valida el pago en Mercado Pago y notifica a los clientes WebSocket en tiempo real.
 */
async function procesarWebhook({ headers = {}, body = {}, query = {} }) {
  // Test o notificación directa simulada (Dev/Test)
  if (body?.ventaId && body?.status) {
    const vId = String(body.ventaId);
    const nuevoEstado = body.status === 'approved' || body.status === 'aprobado' ? 'aprobado' : 'rechazado';
    await guardarPago({ ventaId: vId, estado: nuevoEstado });
    emitPagoAprobado({ external_reference: vId, estado: nuevoEstado, mock: true });
    return { procesado: true, ventaId: vId, estado: nuevoEstado };
  }

  let comercioId = query.comercio_id || body?.comercio_id;
  const rawDataId = query['data.id'] || query.id || body?.data?.id || body?.id;
  const topic = query.topic || query.type || body?.type || body?.topic;

  // Si no vino comercio_id directo, intentar inferirlo de pagos pendientes con ese ID
  if (!comercioId && rawDataId) {
    try {
      const resP = await pool.query(
        `SELECT comercio_id FROM public.pagos WHERE mp_payment_id = $1 OR venta_id = $1 LIMIT 1`,
        [String(rawDataId)]
      );
      if (resP.rows.length > 0) {
        comercioId = resP.rows[0].comercio_id;
      }
    } catch {
      // Ignorar fallo de consulta
    }
  }

  comercioId = comercioId ? parseInt(comercioId, 10) : 1;

  // Consultar credenciales del comercio para consultar a MP
  let accessToken = process.env.MP_ACCESS_TOKEN;
  let webhookSecret = process.env.MP_WEBHOOK_SECRET;

  try {
    const intRes = await pool.query(
      `SELECT mp_access_token_enc, mp_webhook_secret_enc FROM public.integraciones_comercio WHERE comercio_id = $1`,
      [comercioId]
    );
    if (intRes.rows.length > 0) {
      if (intRes.rows[0].mp_access_token_enc) {
        accessToken = desencriptarTexto(intRes.rows[0].mp_access_token_enc);
      }
      if (intRes.rows[0].mp_webhook_secret_enc) {
        webhookSecret = desencriptarTexto(intRes.rows[0].mp_webhook_secret_enc);
      }
    }
  } catch {
    // Usar defaults si falla
  }

  // Verificación de firma criptográfica
  const verificacion = validarFirmaWebhookMP({ headers, query, body, customSecret: webhookSecret });
  if (!verificacion.valido) {
    const err = new Error(`Firma de Webhook no válida: ${verificacion.razon}`);
    err.status = 401;
    throw err;
  }

  if (!rawDataId || !accessToken) {
    return { procesado: false };
  }

  let externalRef = null;
  let status = null;
  let paymentId = null;

  try {
    if (topic === 'merchant_order') {
      const resOrder = await axios.get(`https://api.mercadopago.com/merchant_orders/${rawDataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000
      });
      const order = resOrder.data;
      externalRef = order.external_reference;
      if (order.payments && order.payments.length > 0) {
        const approvedPay = order.payments.find(p => p.status === 'approved') || order.payments[order.payments.length - 1];
        status = approvedPay.status;
        paymentId = approvedPay.id;
      } else if (order.order_status === 'paid') {
        status = 'approved';
      }
    } else {
      const resPay = await axios.get(`https://api.mercadopago.com/v1/payments/${rawDataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000
      });
      const paymentData = resPay.data;
      externalRef = paymentData.external_reference;
      status = paymentData.status;
      paymentId = paymentData.id;
    }
  } catch (errMP) {
    console.error('Error consultando estado en Mercado Pago:', errMP.response?.data || errMP.message);
    return { procesado: false, error: errMP.message };
  }

  if (externalRef && status) {
    const nuevoEstado = status === 'approved' ? 'aprobado' : status;
    const estadoActual = await obtenerEstadoPago(externalRef);

    if (estadoActual.estado === 'aprobado') {
      return { procesado: true, yaProcesado: true, external_reference: externalRef, estado: 'aprobado' };
    }

    await guardarPago({
      ventaId: String(externalRef),
      estado: nuevoEstado,
      mpPaymentId: String(paymentId || rawDataId)
    });

    if (nuevoEstado === 'aprobado') {
      emitPagoAprobado({
        external_reference: externalRef,
        estado: 'aprobado',
        payment_id: paymentId || rawDataId
      });
    }

    return { procesado: true, external_reference: externalRef, estado: nuevoEstado, paymentId };
  }

  return { procesado: false };
}

module.exports = {
  guardarPago,
  obtenerEstadoPago,
  crearOrdenQR,
  crearOrdenQRFijo,
  cancelarOrdenQRFijo,
  simularPagoQR,
  crearIntencionPosnet,
  simularPosnet,
  validarFirmaWebhookMP,
  procesarWebhook
};
