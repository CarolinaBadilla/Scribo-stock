const db = require('../config/db');

// GET /api/stock?sucursalId=1
const obtenerStockPorSucursal = async (req, res) => {
  try {
    const { sucursalId } = req.query;

    let sql = `
      SELECT 
        st.id,
        st.tipo_producto,
        st.producto_id,
        st.sucursal_id,
        st.cantidad,
        st.stock_minimo,
        s.nombre AS sucursal_nombre,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.titulo
          WHEN st.tipo_producto = 'ropa' THEN r.nombre
        END AS nombre_producto,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.codigo_barras
          WHEN st.tipo_producto = 'ropa' THEN r.codigo_barras
        END AS codigo_barras,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.precio_efectivo
          WHEN st.tipo_producto = 'ropa' THEN r.precio_efectivo
        END AS precio_efectivo,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.precio_tarjeta
          WHEN st.tipo_producto = 'ropa' THEN r.precio_tarjeta
        END AS precio_tarjeta,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN COALESCE(l.editorial, '-')
          WHEN st.tipo_producto = 'ropa' THEN COALESCE(r.talle || ' / ' || r.color, '-')
        END AS detalle
      FROM stock st
      LEFT JOIN sucursales s ON st.sucursal_id = s.id
      LEFT JOIN libros l ON st.tipo_producto = 'libro' AND st.producto_id = l.id
      LEFT JOIN ropa r ON st.tipo_producto = 'ropa' AND st.producto_id = r.id
    `;

    const params = [];
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined') {
      params.push(parseInt(sucursalId));
      sql += ` WHERE st.sucursal_id = $${params.length}`;
    }

    sql += ` ORDER BY st.cantidad ASC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo stock:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/stock/actualizar
const actualizarCantidadStock = async (req, res) => {
  try {
    const { tipoProducto, productoId, sucursalId, cantidad, stockMinimo } = req.body;

    if (!tipoProducto || !productoId || !sucursalId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (tipoProducto, productoId, sucursalId)' });
    }

    const sql = `
      INSERT INTO stock (tipo_producto, producto_id, sucursal_id, cantidad, stock_minimo, updated_at)
      VALUES ($1, $2, $3, $4, COALESCE($5, 5), NOW())
      ON CONFLICT (tipo_producto, producto_id, sucursal_id)
      DO UPDATE SET 
        cantidad = EXCLUDED.cantidad,
        stock_minimo = COALESCE(EXCLUDED.stock_minimo, stock.stock_minimo),
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [tipoProducto, parseInt(productoId), parseInt(sucursalId), parseInt(cantidad), stockMinimo ? parseInt(stockMinimo) : null];
    const result = await db.query(sql, values);

    res.json({
      success: true,
      message: 'Stock actualizado correctamente',
      stock: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error actualizando stock:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/stock/alertas?sucursalId=1
const obtenerAlertasStockBajo = async (req, res) => {
  try {
    const { sucursalId } = req.query;

    let sql = `
      SELECT 
        st.id,
        st.tipo_producto,
        st.cantidad,
        st.stock_minimo,
        s.nombre AS sucursal_nombre,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.titulo
          WHEN st.tipo_producto = 'ropa' THEN r.nombre
        END AS nombre_producto
      FROM stock st
      LEFT JOIN sucursales s ON st.sucursal_id = s.id
      LEFT JOIN libros l ON st.tipo_producto = 'libro' AND st.producto_id = l.id
      LEFT JOIN ropa r ON st.tipo_producto = 'ropa' AND st.producto_id = r.id
      WHERE st.cantidad <= st.stock_minimo
    `;

    const params = [];
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined') {
      params.push(parseInt(sucursalId));
      sql += ` AND st.sucursal_id = $${params.length}`;
    }

    sql += ` ORDER BY st.cantidad ASC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error consultando alertas de stock:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  obtenerStockPorSucursal,
  actualizarCantidadStock,
  obtenerAlertasStockBajo
};