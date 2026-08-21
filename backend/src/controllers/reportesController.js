const db = require('../config/db');

// GET /api/reportes/ventas
const obtenerVentas = async (req, res) => {
  try {
    const { sucursalId, fechaInicio, fechaFin } = req.query;

    let sql = `
      SELECT 
        m.id,
        m.fecha,
        m.cantidad,
        m.precio_unitario,
        (m.cantidad * m.precio_unitario * (1 - (m.descuento_porcentaje / 100.0))) AS total,
        s.nombre AS sucursal,
        m.tipo_producto,
        CASE 
          WHEN m.tipo_producto = 'libro' THEN l.titulo
          WHEN m.tipo_producto = 'ropa' THEN r.nombre
        END AS nombre_producto,
        CASE 
          WHEN m.tipo_producto = 'libro' THEN COALESCE(l.autor, '-')
          WHEN m.tipo_producto = 'ropa' THEN COALESCE(r.talle || ' - ' || r.color, '-')
        END AS detalle_producto
      FROM movimientos m
      LEFT JOIN sucursales s ON m.sucursal_id = s.id
      LEFT JOIN libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
      WHERE m.tipo_movimiento = 'venta'
    `;

    const params = [];
    if (sucursalId) {
      params.push(sucursalId);
      sql += ` AND m.sucursal_id = $${params.length}`;
    }
    if (fechaInicio) {
      params.push(fechaInicio);
      sql += ` AND m.fecha >= $${params.length}`;
    }
    if (fechaFin) {
      params.push(fechaFin);
      sql += ` AND m.fecha <= $${params.length}`;
    }

    sql += ` ORDER BY m.fecha DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo reporte de ventas:', error);
    res.status(500).json({ error: 'Error interno al consultar ventas' });
  }
};

// GET /api/reportes/compras
const obtenerCompras = async (req, res) => {
  try {
    const { sucursalId, fechaInicio, fechaFin } = req.query;

    let sql = `
      SELECT 
        m.id,
        m.fecha,
        m.cantidad,
        m.precio_unitario,
        (m.cantidad * m.precio_unitario) AS total,
        s.nombre AS sucursal,
        CASE 
          WHEN m.tipo_producto = 'libro' THEN l.titulo
          WHEN m.tipo_producto = 'ropa' THEN r.nombre
        END AS nombre_producto
      FROM movimientos m
      LEFT JOIN sucursales s ON m.sucursal_id = s.id
      LEFT JOIN libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
      WHERE m.tipo_movimiento = 'compra'
    `;

    const params = [];
    if (sucursalId) {
      params.push(sucursalId);
      sql += ` AND m.sucursal_id = $${params.length}`;
    }
    if (fechaInicio) {
      params.push(fechaInicio);
      sql += ` AND m.fecha >= $${params.length}`;
    }
    if (fechaFin) {
      params.push(fechaFin);
      sql += ` AND m.fecha <= $${params.length}`;
    }

    sql += ` ORDER BY m.fecha DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo reporte de compras:', error);
    res.status(500).json({ error: 'Error interno al consultar compras' });
  }
};

// GET /api/reportes/stock-actual
const obtenerStockActual = async (req, res) => {
  try {
    const { sucursalId } = req.query;

    let sql = `
      SELECT 
        st.id,
        st.cantidad,
        st.stock_minimo,
        st.tipo_producto,
        s.nombre AS sucursal_nombre,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.titulo
          WHEN st.tipo_producto = 'ropa' THEN r.nombre
        END AS nombre_producto,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.precio_efectivo
          WHEN st.tipo_producto = 'ropa' THEN r.precio_efectivo
        END AS precio_efectivo,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.precio_tarjeta
          WHEN st.tipo_producto = 'ropa' THEN r.precio_tarjeta
        END AS precio_tarjeta,
        CASE 
          WHEN st.tipo_producto = 'libro' THEN l.editorial
          WHEN st.tipo_producto = 'ropa' THEN r.talle || ' / ' || r.color
        END AS detalle
      FROM stock st
      LEFT JOIN sucursales s ON st.sucursal_id = s.id
      LEFT JOIN libros l ON st.tipo_producto = 'libro' AND st.producto_id = l.id
      LEFT JOIN ropa r ON st.tipo_producto = 'ropa' AND st.producto_id = r.id
    `;

    const params = [];
    if (sucursalId) {
      params.push(sucursalId);
      sql += ` WHERE st.sucursal_id = $${params.length}`;
    }

    sql += ` ORDER BY st.cantidad ASC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo stock actual:', error);
    res.status(500).json({ error: 'Error interno al consultar stock' });
  }
};

// GET /api/reportes/movimientos
const obtenerMovimientos = async (req, res) => {
  try {
    const { sucursalId, fechaInicio, fechaFin } = req.query;

    let sql = `
      SELECT 
        m.id,
        m.fecha,
        m.tipo_movimiento AS tipo,
        m.cantidad,
        m.precio_unitario,
        (m.cantidad * m.precio_unitario) AS total,
        s.nombre AS sucursal,
        CASE 
          WHEN m.tipo_producto = 'libro' THEN l.titulo
          WHEN m.tipo_producto = 'ropa' THEN r.nombre
        END AS nombre_producto
      FROM movimientos m
      LEFT JOIN sucursales s ON m.sucursal_id = s.id
      LEFT JOIN libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
    `;

    const params = [];
    if (sucursalId) {
      params.push(sucursalId);
      sql += ` WHERE m.sucursal_id = $${params.length}`;
    }
    if (fechaInicio) {
      params.push(fechaInicio);
      sql += params.length === 1 ? ' WHERE' : ' AND';
      sql += ` m.fecha >= $${params.length}`;
    }
    if (fechaFin) {
      params.push(fechaFin);
      sql += params.length === 1 ? ' WHERE' : ' AND';
      sql += ` m.fecha <= $${params.length}`;
    }

    sql += ` ORDER BY m.fecha DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo movimientos:', error);
    res.status(500).json({ error: 'Error interno al consultar movimientos' });
  }
};

module.exports = {
  obtenerVentas,
  obtenerCompras,
  obtenerStockActual,
  obtenerMovimientos,
};