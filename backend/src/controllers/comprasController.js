const { pool } = require('../config/db');

// POST /api/compras/registrar
const registrarCompra = async (req, res) => {
  const client = await pool.connect();

  try {
    const { sucursalId, items, usuarioId } = req.body;
    const movimientos = [];

    await client.query('BEGIN'); // Iniciar transacción SQL

    for (const item of items) {
      // 1. Insertar movimiento de tipo 'compra'
      const insertMovimientoSql = `
        INSERT INTO movimientos (
          tipo_producto, producto_id, sucursal_id, tipo_movimiento, 
          cantidad, precio_unitario, usuario_id
        ) VALUES ($1, $2, $3, 'compra', $4, $5, $6)
        RETURNING *;
      `;

      const valuesMov = [
        item.tipoProducto,
        parseInt(item.productoId),
        parseInt(sucursalId),
        parseInt(item.cantidad),
        parseFloat(item.precioCompra),
        usuarioId || null
      ];

      const movRes = await client.query(insertMovimientoSql, valuesMov);
      movimientos.push(movRes.rows[0]);

      // 2. Aumentar stock de forma atómica en la tabla stock
      const updateStockSql = `
        INSERT INTO stock (tipo_producto, producto_id, sucursal_id, cantidad, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (tipo_producto, producto_id, sucursal_id)
        DO UPDATE SET 
          cantidad = stock.cantidad + EXCLUDED.cantidad,
          updated_at = NOW();
      `;

      await client.query(updateStockSql, [
        item.tipoProducto,
        parseInt(item.productoId),
        parseInt(sucursalId),
        parseInt(item.cantidad)
      ]);
    }

    await client.query('COMMIT'); // Confirmar cambios

    res.json({
      success: true,
      message: 'Compra registrada y stock actualizado correctamente',
      movimientos
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Deshacer cambios si falla
    console.error('❌ Error registrando compra:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  registrarCompra
};