// backend/src/routes/ventas.js
const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { registrarVentaSchema } = require('../schemas/ventasSchema');

const router = express.Router();

const MAP_TABLAS_LEGACY = Object.freeze({
  libro: { tabla: 'libros', col: 'titulo' },
  ropa: { tabla: 'ropa', col: 'nombre' }
});

const registrarVentaHandler = async (req, res) => {
  const { 
    sucursalId, 
    tipoPago, 
    items, 
    ventaId, 
    emitir_factura, 
    cliente_doc_tipo, 
    cliente_doc_nro 
  } = req.body;
  const usuario = req.usuario;
  const comercioId = req.usuario.comercio_id;

  // 1. CONTROL DE ACCESO (RBAC / IDOR): Los operadores solo pueden vender en su sucursal asignada
  const esAdmin = usuario.rol === 'jefe' || usuario.rol === 'DUENO';
  if (!esAdmin && usuario.sucursalId && Number(usuario.sucursalId) !== Number(sucursalId)) {
    return res.status(403).json({ 
      error: 'Acceso denegado: No tienes autorización para registrar ventas en una sucursal distinta a la asignada' 
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Transacción SQL atómica

    // 1.1 Verificar que la sucursal pertenece al comercio del usuario
    const sucursalCheck = await client.query(
      'SELECT id FROM sucursales WHERE id = $1 AND comercio_id = $2',
      [sucursalId, comercioId]
    );
    if (sucursalCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'La sucursal indicada no pertenece a tu comercio' });
    }

    // 2. IDEMPOTENCIA: Si se pasa ventaId, evitar doble registro de la misma venta
    if (ventaId) {
      const pagoExistente = await client.query(
        'SELECT estado, detalle FROM pagos WHERE venta_id = $1 FOR UPDATE',
        [String(ventaId)]
      );

      if (pagoExistente.rows.length > 0) {
        const detalle = pagoExistente.rows[0].detalle || {};
        if (detalle.venta_registrada === true) {
          await client.query('ROLLBACK');
          return res.status(409).json({ 
            error: 'Esta venta ya fue registrada previamente en el sistema (Prevención de doble cobro/descuento)' 
          });
        }
      }
    }

    const movimientos = [];
    let totalVentaCalculado = 0;

    for (const item of items) {
      const tipo = (item.tipoProducto || item.categoria || 'general').toLowerCase();
      const rawProdId = item.producto_unificado_id || item.productoId || item.id;
      const cantidad = Number(item.cantidad);
      const descuento = Number(item.descuento) || 0;

      // Restricción de permisos para descuentos elevados
      if (descuento > 50 && !esAdmin) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          error: `El descuento del ${descuento}% requiere autorización de un administrador` 
        });
      }

      // CASO ESPECIAL: Ítem Rápido / Varios (sin producto en catálogo ni descuento de stock)
      const esTemporal = Boolean(item.es_temporal) || !rawProdId || tipo === 'varios';
      if (esTemporal) {
        const nombreVarios = (item.descripcion || item.nombre || 'Varios').trim();
        const precioOficial = Number(item.precio_unitario ?? item.precioUnitario ?? 0);

        const insertQuery = `
          INSERT INTO public.movimientos (
            comercio_id, producto_unificado_id, tipo_producto, producto_id,
            sucursal_id, tipo_movimiento, cantidad, precio_unitario,
            descuento_porcentaje, usuario_id, producto_nombre, fecha
          ) VALUES ($1, NULL, 'varios', NULL, $2, 'venta', $3, $4, $5, $6, $7, NOW())
          RETURNING *
        `;

        const values = [
          comercioId,
          sucursalId,
          cantidad,
          precioOficial,
          descuento,
          usuario.id,
          nombreVarios
        ];

        const movRes = await client.query(insertQuery, values);
        movimientos.push(movRes.rows[0]);
        totalVentaCalculado += (precioOficial * cantidad) * (1 - descuento / 100);
        continue;
      }

      // 3. Obtener producto y precio oficial desde PostgreSQL (Anti Price Tampering y Catálogo Unificado)
      let prodDb = null;
      let productoUnificadoId = null;

      // 3.1 Búsqueda primaria en public.productos por ID y comercio_id
      const prodRes = await client.query(
        `SELECT id, nombre, categoria, precio_efectivo, precio_tarjeta, es_pesable, atributos
         FROM public.productos 
         WHERE id = $1 AND comercio_id = $2 AND (activo = TRUE OR activo IS NULL)`,
        [rawProdId, comercioId]
      );

      if (prodRes.rows.length > 0) {
        prodDb = prodRes.rows[0];
        productoUnificadoId = prodDb.id;
      } else {
        // 3.2 Búsqueda de compatibilidad si el frontend envía IDs de libros o ropa migrados
        const mappingRes = await client.query(
          `SELECT p.id, p.nombre, p.categoria, p.precio_efectivo, p.precio_tarjeta, p.es_pesable, p.atributos
           FROM public.stock st
           JOIN public.productos p ON p.id = st.producto_unificado_id
           WHERE st.tipo_producto = $1 AND st.producto_id = $2 AND st.comercio_id = $3
           LIMIT 1`,
          [tipo, rawProdId, comercioId]
        );

        if (mappingRes.rows.length > 0) {
          prodDb = mappingRes.rows[0];
          productoUnificadoId = prodDb.id;
        } else if (MAP_TABLAS_LEGACY[tipo]) {
          // 3.3 Fallback legacy directo si el producto sigue en libros/ropa
          const configLegacy = MAP_TABLAS_LEGACY[tipo];
          const legacyRes = await client.query(
            `SELECT ${configLegacy.col} AS nombre, precio_efectivo, precio_tarjeta 
             FROM ${configLegacy.tabla} 
             WHERE id = $1 AND (activo = TRUE OR activo IS NULL)`,
            [rawProdId]
          );

          if (legacyRes.rows.length > 0) {
            prodDb = {
              id: null,
              nombre: legacyRes.rows[0].nombre,
              categoria: tipo,
              precio_efectivo: legacyRes.rows[0].precio_efectivo,
              precio_tarjeta: legacyRes.rows[0].precio_tarjeta,
              es_pesable: false
            };
          }
        }
      }

      if (!prodDb) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto "${tipo}" ID ${rawProdId} no encontrado o dado de baja` });
      }

      const metodoNormalizado = (tipoPago || '').toLowerCase();
      const precioOficial = (metodoNormalizado === 'efectivo')
        ? Number(prodDb.precio_efectivo)
        : Number(prodDb.precio_tarjeta || prodDb.precio_efectivo);

      // 4. Bloqueo de fila de stock y validación de stock disponible (soporta decimales para balanza)
      const stockRes = await client.query(
        `SELECT id, cantidad FROM public.stock 
         WHERE producto_unificado_id = $1 
           AND sucursal_id = $2 
           AND comercio_id = $3 
         FOR UPDATE`,
        [productoUnificadoId, sucursalId, comercioId]
      );

      const stockFila = stockRes.rows[0];
      const stockDisponible = stockFila ? Number(stockFila.cantidad) : 0;

      if (stockDisponible < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Stock insuficiente para "${prodDb.nombre}". Disponible: ${stockDisponible}, Solicitado: ${cantidad}` 
        });
      }

      // 5. Registrar movimiento de venta (Multi-Tenant y producto unificado)
      const insertQuery = `
        INSERT INTO public.movimientos (
          comercio_id, producto_unificado_id, tipo_producto, producto_id,
          sucursal_id, tipo_movimiento, cantidad, precio_unitario,
          descuento_porcentaje, usuario_id, producto_nombre, fecha
        ) VALUES ($1, $2, $3, $4, $5, 'venta', $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `;

      const values = [
        comercioId,
        productoUnificadoId,
        prodDb.categoria || tipo,
        rawProdId,
        sucursalId,
        cantidad, // Decimal NUMERIC(10,3)
        precioOficial,
        descuento,
        usuario.id,
        prodDb.nombre
      ];

      const movRes = await client.query(insertQuery, values);
      movimientos.push(movRes.rows[0]);
      totalVentaCalculado += (precioOficial * cantidad) * (1 - descuento / 100);

      // 6. Actualizar stock con condición estricta de carrera (cantidad >= cantidad_vendida)
      const updateStockRes = await client.query(
        `UPDATE public.stock 
         SET cantidad = cantidad - $1, updated_at = NOW() 
         WHERE producto_unificado_id = $2 
           AND sucursal_id = $3 
           AND comercio_id = $4 
           AND cantidad >= $1`,
        [cantidad, productoUnificadoId, sucursalId, comercioId]
      );

      if (updateStockRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Condición de carrera detectada: Stock insuficiente al momento de descontar "${prodDb.nombre}"` 
        });
      }
    }

    // 7. Marcar la orden de pago como venta_registrada si existía
    if (ventaId) {
      await client.query(
        `UPDATE public.pagos 
         SET detalle = jsonb_set(COALESCE(detalle, '{}'::jsonb), '{venta_registrada}', 'true'::jsonb),
             updated_at = NOW()
         WHERE venta_id = $1`,
        [String(ventaId)]
      );
    }

    await client.query('COMMIT');

    // 8. Emisión de Factura Electrónica AFIP / ARCA (Paso 4)
    let facturaAfip = null;
    let afipAdvertencia = null;

    if (emitir_factura === true || emitir_factura === 'true') {
      try {
        const afipService = require('../services/afipService');
        facturaAfip = await afipService.emitirComprobanteVenta(comercioId, {
          total: totalVentaCalculado,
          sucursalId,
          clienteDocTipo: cliente_doc_tipo || 99,
          clienteDocNro: cliente_doc_nro || '0'
        });

        const movIds = movimientos.map(m => m.id);
        if (movIds.length > 0) {
          await pool.query(
            `UPDATE public.movimientos 
             SET facturado_afip = true,
                 afip_tipo_comprobante = $1,
                 afip_punto_venta = $2,
                 afip_numero_comprobante = $3,
                 afip_cae = $4,
                 afip_cae_vencimiento = $5,
                 cliente_doc_tipo = $6,
                 cliente_doc_nro = $7
             WHERE id = ANY($8::int[]) AND comercio_id = $9`,
            [
              facturaAfip.tipoComprobante,
              facturaAfip.puntoVenta,
              facturaAfip.numeroComprobante,
              facturaAfip.cae,
              facturaAfip.caeVencimiento,
              cliente_doc_tipo || 99,
              String(cliente_doc_nro || '0'),
              movIds,
              comercioId
            ]
          );

          movimientos.forEach(m => {
            m.facturado_afip = true;
            m.afip_tipo_comprobante = facturaAfip.tipoComprobante;
            m.afip_punto_venta = facturaAfip.puntoVenta;
            m.afip_numero_comprobante = facturaAfip.numeroComprobante;
            m.afip_cae = facturaAfip.cae;
            m.afip_cae_vencimiento = facturaAfip.caeVencimiento;
            m.afip_qr_data = facturaAfip.qrAfipUrl;
            m.cliente_doc_tipo = cliente_doc_tipo || 99;
            m.cliente_doc_nro = String(cliente_doc_nro || '0');
          });
        }
      } catch (errAfip) {
        console.error('⚠️ Facturación AFIP no completada:', errAfip.message);
        afipAdvertencia = `Venta registrada con éxito pero AFIP no pudo autorizar la factura: ${errAfip.message}. Puedes reintentarla desde el historial.`;
      }
    }

    return res.json({
      success: true,
      message: afipAdvertencia || 'Venta registrada con precios validados por el servidor',
      advertencia_afip: afipAdvertencia,
      movimientos,
      factura: facturaAfip
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error registrando venta:', error);
    return res.status(500).json({ 
      error: process.env.NODE_ENV === 'production' 
        ? 'Error interno al registrar la venta' 
        : error.message 
    });
  } finally {
    client.release();
  }
};

router.post('/registrar', verificarToken, validar(registrarVentaSchema), registrarVentaHandler);
router.post('/', verificarToken, validar(registrarVentaSchema), registrarVentaHandler);

/**
 * POST /api/ventas/:id/facturar-afip
 * Reintenta o emite la factura electrónica de AFIP para una venta previa registrada que aún no tenga CAE
 */
router.post('/:id/facturar-afip', verificarToken, async (req, res) => {
  const movId = parseInt(req.params.id, 10);
  const comercioId = req.usuario?.comercio_id;
  const { cliente_doc_tipo, cliente_doc_nro } = req.body;

  if (isNaN(movId) || movId <= 0) {
    return res.status(400).json({ error: 'ID de movimiento inválido' });
  }

  try {
    const movRes = await pool.query(
      `SELECT * FROM public.movimientos WHERE id = $1 AND comercio_id = $2`,
      [movId, comercioId]
    );

    if (movRes.rows.length === 0) {
      return res.status(404).json({ error: 'Venta o movimiento no encontrado' });
    }

    const mov = movRes.rows[0];
    if (mov.facturado_afip && mov.afip_cae) {
      return res.json({
        success: true,
        yaFacturado: true,
        mensaje: `Esta venta ya está facturada (CAE: ${mov.afip_cae})`,
        movimiento: mov
      });
    }

    const totalVenta = Number(mov.cantidad) * Number(mov.precio_unitario) * (1 - (Number(mov.descuento_porcentaje || 0) / 100));

    const afipService = require('../services/afipService');
    const factura = await afipService.emitirComprobanteVenta(comercioId, {
      total: totalVenta,
      sucursalId: mov.sucursal_id,
      clienteDocTipo: cliente_doc_tipo || mov.cliente_doc_tipo || 99,
      clienteDocNro: cliente_doc_nro || mov.cliente_doc_nro || '0'
    });

    await pool.query(
      `UPDATE public.movimientos 
       SET facturado_afip = true,
           afip_tipo_comprobante = $1,
           afip_punto_venta = $2,
           afip_numero_comprobante = $3,
           afip_cae = $4,
           afip_cae_vencimiento = $5,
           cliente_doc_tipo = $6,
           cliente_doc_nro = $7
       WHERE id = $8 AND comercio_id = $9`,
      [
        factura.tipoComprobante,
        factura.puntoVenta,
        factura.numeroComprobante,
        factura.cae,
        factura.caeVencimiento,
        cliente_doc_tipo || mov.cliente_doc_tipo || 99,
        String(cliente_doc_nro || mov.cliente_doc_nro || '0'),
        movId,
        comercioId
      ]
    );

    return res.json({
      success: true,
      mensaje: 'Factura autorizada exitosamente por AFIP / ARCA',
      factura,
      movimiento_id: movId
    });
  } catch (error) {
    console.error('Error al facturar venta previa en AFIP:', error);
    return res.status(400).json({ error: `Error de facturación AFIP: ${error.message}` });
  }
});

module.exports = router;
