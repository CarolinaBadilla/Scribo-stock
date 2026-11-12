// backend/src/routes/ventas.js
const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { registrarVentaSchema } = require('../schemas/ventasSchema');

const router = express.Router();

const MAP_TABLAS = Object.freeze({
  libro: { tabla: 'libros', col: 'titulo' },
  ropa: { tabla: 'ropa', col: 'nombre' }
});

router.post('/registrar', verificarToken, validar(registrarVentaSchema), async (req, res) => {
  const { sucursalId, tipoPago, items, ventaId } = req.body;
  const usuario = req.usuario;

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

    for (const item of items) {
      const tipo = item.tipoProducto.toLowerCase();
      const prodId = item.productoId;
      const cantidad = item.cantidad;
      const descuento = item.descuento || 0;

      // Restricción de permisos para descuentos elevados
      if (descuento > 50 && !esAdmin) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          error: `El descuento del ${descuento}% requiere autorización de un administrador` 
        });
      }

      // 3. Obtener precio oficial desde la base de datos (Anti Price Tampering)
      const config = MAP_TABLAS[tipo];
      if (!config) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Tipo de producto no soportado: ${tipo}` });
      }

      const prodRes = await client.query(
        `SELECT ${config.col} AS nombre, precio_efectivo, precio_tarjeta 
         FROM ${config.tabla} 
         WHERE id = $1 AND (activo = TRUE OR activo IS NULL)`,
        [prodId]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${tipo} ID ${prodId} no disponible o dado de baja` });
      }

      const prodDb = prodRes.rows[0];
      const precioOficial = tipoPago === 'efectivo'
        ? Number(prodDb.precio_efectivo)
        : Number(prodDb.precio_tarjeta || prodDb.precio_efectivo);

      // 4. Comprobación y bloqueo de fila de stock (FOR UPDATE)
      const stockRes = await client.query(
        'SELECT cantidad FROM stock WHERE tipo_producto = $1 AND producto_id = $2 AND sucursal_id = $3 FOR UPDATE',
        [tipo, prodId, sucursalId]
      );

      const stockDisponible = stockRes.rows.length > 0 ? stockRes.rows[0].cantidad : 0;
      if (stockDisponible < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Stock insuficiente para "${prodDb.nombre}". Disponible: ${stockDisponible}, Solicitado: ${cantidad}` 
        });
      }

      // 5. Registrar movimiento auditado
      const insertQuery = `
        INSERT INTO movimientos (
          tipo_producto, producto_id, sucursal_id, tipo_movimiento, 
          cantidad, precio_unitario, descuento_porcentaje, usuario_id, producto_nombre
        ) VALUES ($1, $2, $3, 'venta', $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        tipo,
        prodId,
        sucursalId,
        cantidad,
        precioOficial,
        descuento,
        usuario.id,
        prodDb.nombre
      ];

      const movRes = await client.query(insertQuery, values);
      movimientos.push(movRes.rows[0]);

      // 6. Actualizar stock con condición estricta de carrera (cantidad >= cantidad_vendida)
      const updateStockRes = await client.query(
        `UPDATE stock 
         SET cantidad = cantidad - $1, updated_at = NOW() 
         WHERE tipo_producto = $2 AND producto_id = $3 AND sucursal_id = $4 AND cantidad >= $1`,
        [cantidad, tipo, prodId, sucursalId]
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
        `UPDATE pagos 
         SET detalle = jsonb_set(COALESCE(detalle, '{}'::jsonb), '{venta_registrada}', 'true'::jsonb),
             updated_at = NOW()
         WHERE venta_id = $1`,
        [String(ventaId)]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Venta registrada con precios validados por el servidor',
      movimientos
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Error en registro de venta:', error);
    return res.status(500).json({ 
      error: process.env.NODE_ENV === 'production' 
        ? 'Error interno al procesar la venta' 
        : error.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
