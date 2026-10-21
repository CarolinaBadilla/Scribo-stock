const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// 🔒 Proteger el registro de ventas
router.post('/registrar', verificarToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { sucursalId, tipoPago, items } = req.body;
    // 🔒 Seguridad: tomar el usuario autenticado directamente del token, nunca del body
    const usuarioId = req.usuario.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La venta debe contener al menos un producto' });
    }

    const movimientos = [];
    await client.query('BEGIN');

    for (const item of items) {
      const precioUnitario = parseFloat(item.precioUnitario) || 0;
      const cantidad = parseInt(item.cantidad, 10);
      const descuento = parseFloat(item.descuento) || 0;

      // 1. Insertar en movimientos
      const insertQuery = `
        INSERT INTO movimientos (
          tipo_producto, producto_id, sucursal_id, tipo_movimiento, 
          cantidad, precio_unitario, descuento_porcentaje, usuario_id, producto_nombre
        ) VALUES ($1, $2, $3, 'venta', $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        item.tipoProducto,
        item.productoId,
        sucursalId,
        cantidad,
        precioUnitario,
        descuento,
        usuarioId,
        item.nombre || item.nombreProducto || null
      ];

      const movRes = await client.query(insertQuery, values);
      movimientos.push(movRes.rows[0]);

      // 2. Descontar stock
      const updateStockQuery = `
        UPDATE stock 
        SET cantidad = cantidad - $1, updated_at = NOW()
        WHERE tipo_producto = $2 AND producto_id = $3 AND sucursal_id = $4
      `;

      await client.query(updateStockQuery, [
        cantidad,
        item.tipoProducto,
        item.productoId,
        sucursalId
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Venta registrada y stock actualizado',
      movimientos
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en venta:', error);
    res.status(500).json({ error: 'Error interno al registrar la venta' });
  } finally {
    client.release();
  }
});

module.exports = router;