const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.post('/registrar', async (req, res) => {
  const client = await pool.connect();

  try {
    const { sucursalId, tipoPago, items, usuarioId } = req.body;
    const movimientos = [];

    await client.query('BEGIN'); // Iniciar transacción SQL

    for (const item of items) {
      const precioUnitario = item.precioUnitario;

      // 1. Insertar en tabla movimientos
      const insertQuery = `
        INSERT INTO movimientos (
          tipo_producto, producto_id, sucursal_id, tipo_movimiento, 
          cantidad, precio_unitario, descuento_porcentaje, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        item.tipoProducto,
        item.productoId,
        sucursalId,
        'venta',
        item.cantidad,
        precioUnitario,
        item.descuento || 0,
        usuarioId
      ];

      const movRes = await client.query(insertQuery, values);
      movimientos.push(movRes.rows[0]);

      // 2. Descontar stock directamente en la base de datos
      const updateStockQuery = `
        UPDATE stock 
        SET cantidad = cantidad - $1 
        WHERE tipo_producto = $2 AND producto_id = $3 AND sucursal_id = $4
      `;

      await client.query(updateStockQuery, [
        item.cantidad,
        item.tipoProducto,
        item.productoId,
        sucursalId
      ]);
    }

    await client.query('COMMIT'); // Confirmar la transacción

    res.json({
      success: true,
      message: 'Venta registrada y stock actualizado en PostgreSQL',
      movimientos
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Deshacer cambios si algo falla
    console.error('❌ Error en venta:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release(); // Liberar el cliente de la pool
  }
});

module.exports = router;