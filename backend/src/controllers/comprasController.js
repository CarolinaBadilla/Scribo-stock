const db = require('../config/db');

// POST /api/compras/registrar
const registrarCompra = async (req, res) => {
  const client = await db.connect(); // 👈 Uso directo de db.connect()

  try {
    const { sucursalId, items, usuarioId } = req.body;
    const movimientos = [];

    await client.query('BEGIN');

    for (const item of items) {
      const tipo = item.tipoProducto ? item.tipoProducto.toString().trim().toLowerCase() : '';
      const prodId = parseInt(item.productoId, 10);
      const cant = parseInt(item.cantidad, 10);
      const precioCompra = parseFloat(item.precioCompra) || 0;

      // 1. Insertar movimiento de tipo 'compra'
      const insertMovimientoSql = `
        INSERT INTO movimientos (
          tipo_producto, producto_id, sucursal_id, tipo_movimiento, 
          cantidad, precio_unitario, usuario_id, fecha
        ) VALUES ($1, $2, $3, 'compra', $4, $5, $6, NOW())
        RETURNING *;
      `;

      const valuesMov = [
        tipo,
        prodId,
        parseInt(sucursalId, 10),
        cant,
        precioCompra,
        usuarioId || null
      ];

      const movRes = await client.query(insertMovimientoSql, valuesMov);
      movimientos.push(movRes.rows[0]);

      // 2. Actualizar precio de compra del producto al costo más reciente
      if (tipo === 'libro') {
        await client.query(`UPDATE libros SET precio_compra = $1, updated_at = NOW() WHERE id = $2`, [precioCompra, prodId]);
      } else if (tipo === 'ropa') {
        await client.query(`UPDATE ropa SET precio_compra = $1, updated_at = NOW() WHERE id = $2`, [precioCompra, prodId]);
      }

      // 3. Aumentar stock de forma atómica
      const updateStockSql = `
        INSERT INTO stock (tipo_producto, producto_id, sucursal_id, cantidad, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (tipo_producto, producto_id, sucursal_id)
        DO UPDATE SET 
          cantidad = stock.cantidad + EXCLUDED.cantidad,
          updated_at = NOW();
      `;

      await client.query(updateStockSql, [
        tipo,
        prodId,
        parseInt(sucursalId, 10),
        cant
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Compra registrada y stock actualizado correctamente',
      movimientos
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error registrando compra:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  registrarCompra
};