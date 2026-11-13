// backend/src/controllers/reportesController.js
const db = require('../config/db');

// GET /api/reportes/ventas
const obtenerVentas = async (req, res) => {
  try {
    const { sucursalId, fechaInicio, fechaFin } = req.query;
    const comercioId = req.usuario?.comercio_id;

    let sql = `
      SELECT 
        m.id,
        m.fecha,
        m.cantidad,
        m.precio_unitario,
        (m.cantidad * m.precio_unitario * (1 - (COALESCE(m.descuento_porcentaje, 0) / 100.0))) AS total,
        s.nombre AS sucursal,
        COALESCE(p.categoria, m.tipo_producto) AS tipo_producto,
        COALESCE(p.nombre, l.titulo, r.nombre, m.producto_nombre, 'Producto S/D') AS nombre_producto,
        COALESCE(p.es_pesable, false) AS es_pesable,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        m.facturado_afip,
        m.afip_tipo_comprobante,
        m.afip_punto_venta,
        m.afip_numero_comprobante,
        m.afip_cae,
        m.afip_cae_vencimiento,
        m.cliente_doc_tipo,
        m.cliente_doc_nro,
        CASE 
          WHEN p.id IS NOT NULL AND p.atributos IS NOT NULL AND p.atributos != '{}'::jsonb THEN p.atributos::text
          WHEN m.tipo_producto = 'libro' THEN COALESCE(l.autor, '-')
          WHEN m.tipo_producto = 'ropa' THEN COALESCE(r.talle || ' - ' || r.color, '-')
          ELSE '-'
        END AS detalle_producto
      FROM public.movimientos m
      LEFT JOIN public.sucursales s ON m.sucursal_id = s.id
      LEFT JOIN public.productos p ON m.producto_unificado_id = p.id AND m.comercio_id = p.comercio_id
      LEFT JOIN public.libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN public.ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
      WHERE m.tipo_movimiento = 'venta' 
        AND m.comercio_id = $1
    `;

    const params = [comercioId];

    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined' && sucursalId !== '') {
      params.push(parseInt(sucursalId, 10));
      sql += ` AND m.sucursal_id = $${params.length}`;
    }

    if (fechaInicio && fechaInicio.trim() !== '') {
      params.push(fechaInicio.trim());
      sql += ` AND m.fecha::DATE >= $${params.length}::DATE`;
    }

    if (fechaFin && fechaFin.trim() !== '') {
      params.push(fechaFin.trim());
      sql += ` AND m.fecha::DATE <= $${params.length}::DATE`;
    }

    sql += ` ORDER BY m.fecha DESC`;

    const result = await db.query(sql, params);
    const rows = result.rows.map(r => ({
      ...r,
      cantidad: Number(r.cantidad) || 0,
      precio_unitario: Number(r.precio_unitario) || 0,
      total: Number(r.total) || 0
    }));
    res.json(rows);
  } catch (error) {
    console.error('❌ Error obteniendo reporte de ventas:', error);
    res.status(500).json({ error: 'Error interno al consultar ventas' });
  }
};

// GET /api/reportes/compras
const obtenerCompras = async (req, res) => {
  try {
    const { sucursalId, fechaInicio, fechaFin } = req.query;
    const comercioId = req.usuario?.comercio_id;

    let sql = `
      SELECT 
        m.id,
        m.fecha,
        m.cantidad,
        m.precio_unitario,
        (m.cantidad * m.precio_unitario) AS total,
        s.nombre AS sucursal,
        COALESCE(p.categoria, m.tipo_producto) AS tipo_producto,
        COALESCE(p.nombre, l.titulo, r.nombre, m.producto_nombre, 'Producto eliminado') AS nombre_producto,
        COALESCE(p.es_pesable, false) AS es_pesable,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        m.facturado_afip,
        m.afip_tipo_comprobante,
        m.afip_punto_venta,
        m.afip_numero_comprobante,
        m.afip_cae,
        m.afip_cae_vencimiento,
        m.cliente_doc_tipo,
        m.cliente_doc_nro
      FROM public.movimientos m
      LEFT JOIN public.sucursales s ON m.sucursal_id = s.id
      LEFT JOIN public.productos p ON m.producto_unificado_id = p.id AND m.comercio_id = p.comercio_id
      LEFT JOIN public.libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN public.ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
      WHERE m.tipo_movimiento = 'compra'
        AND m.comercio_id = $1
    `;

    const params = [comercioId];

    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined' && sucursalId !== '') {
      params.push(parseInt(sucursalId, 10));
      sql += ` AND m.sucursal_id = $${params.length}`;
    }

    if (fechaInicio && fechaInicio.trim() !== '') {
      params.push(fechaInicio.trim());
      sql += ` AND m.fecha::DATE >= $${params.length}::DATE`;
    }

    if (fechaFin && fechaFin.trim() !== '') {
      params.push(fechaFin.trim());
      sql += ` AND m.fecha::DATE <= $${params.length}::DATE`;
    }

    sql += ` ORDER BY m.fecha DESC`;

    const result = await db.query(sql, params);
    const rows = result.rows.map(r => ({
      ...r,
      cantidad: Number(r.cantidad) || 0,
      precio_unitario: Number(r.precio_unitario) || 0,
      total: Number(r.total) || 0
    }));
    res.json(rows);
  } catch (error) {
    console.error('❌ Error obteniendo reporte de compras:', error);
    res.status(500).json({ error: 'Error interno al consultar compras' });
  }
};

// GET /api/reportes/stock-actual
const obtenerStockActual = async (req, res) => {
  try {
    const { sucursalId } = req.query;
    const comercioId = req.usuario?.comercio_id;

    let sql = `
      SELECT 
        st.id,
        st.cantidad,
        st.stock_minimo,
        COALESCE(p.categoria, st.tipo_producto) AS tipo_producto,
        s.nombre AS sucursal_nombre,
        COALESCE(p.nombre, l.titulo, r.nombre, 'Producto') AS nombre_producto,
        COALESCE(p.precio_efectivo, l.precio_efectivo, r.precio_efectivo, 0) AS precio_efectivo,
        COALESCE(p.precio_tarjeta, l.precio_tarjeta, r.precio_tarjeta, 0) AS precio_tarjeta,
        COALESCE(p.es_pesable, false) AS es_pesable,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        p.atributos,
        CASE 
          WHEN p.id IS NOT NULL AND p.atributos IS NOT NULL AND p.atributos != '{}'::jsonb THEN p.atributos::text
          WHEN st.tipo_producto = 'libro' THEN l.editorial
          WHEN st.tipo_producto = 'ropa' THEN r.talle || ' / ' || r.color
          ELSE '-'
        END AS detalle
      FROM public.stock st
      LEFT JOIN public.sucursales s ON st.sucursal_id = s.id
      LEFT JOIN public.productos p ON st.producto_unificado_id = p.id AND st.comercio_id = p.comercio_id
      LEFT JOIN public.libros l ON st.tipo_producto = 'libro' AND st.producto_id = l.id
      LEFT JOIN public.ropa r ON st.tipo_producto = 'ropa' AND st.producto_id = r.id
      WHERE st.comercio_id = $1
        AND (p.activo = true OR (p.id IS NULL AND (COALESCE(l.activo, true) = true AND COALESCE(r.activo, true) = true)))
    `;

    const params = [comercioId];
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined' && sucursalId !== '') {
      params.push(parseInt(sucursalId, 10));
      sql += ` AND st.sucursal_id = $${params.length}`;
    }

    sql += ` ORDER BY st.cantidad ASC`;

    const result = await db.query(sql, params);
    const rows = result.rows.map(r => ({
      ...r,
      cantidad: Number(r.cantidad) || 0,
      stock_minimo: Number(r.stock_minimo) || 0,
      precio_efectivo: Number(r.precio_efectivo) || 0,
      precio_tarjeta: Number(r.precio_tarjeta) || 0
    }));
    res.json(rows);
  } catch (error) {
    console.error('❌ Error obteniendo stock actual:', error);
    res.status(500).json({ error: 'Error interno al consultar stock' });
  }
};

// GET /api/reportes/movimientos
const obtenerMovimientos = async (req, res) => {
  try {
    const { sucursalId, fechaInicio, fechaFin } = req.query;
    const comercioId = req.usuario?.comercio_id;
    const esAdmin = req.usuario?.rol === 'jefe' || req.usuario?.rol === 'DUENO';
    const sucursalObjetivo = esAdmin 
      ? (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined' && sucursalId !== '' ? parseInt(sucursalId, 10) : null)
      : req.usuario?.sucursalId;

    let sql = `
      SELECT 
        m.id,
        m.fecha,
        m.tipo_movimiento AS tipo,
        m.cantidad,
        m.precio_unitario,
        (m.cantidad * m.precio_unitario) AS total,
        s.nombre AS sucursal,
        COALESCE(p.categoria, m.tipo_producto) AS tipo_producto,
        COALESCE(p.nombre, l.titulo, r.nombre, m.producto_nombre, 'Producto eliminado') AS nombre_producto,
        COALESCE(p.es_pesable, false) AS es_pesable,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        m.facturado_afip,
        m.afip_tipo_comprobante,
        m.afip_punto_venta,
        m.afip_numero_comprobante,
        m.afip_cae,
        m.afip_cae_vencimiento,
        m.cliente_doc_tipo,
        m.cliente_doc_nro
      FROM public.movimientos m
      LEFT JOIN public.sucursales s ON m.sucursal_id = s.id
      LEFT JOIN public.productos p ON m.producto_unificado_id = p.id AND m.comercio_id = p.comercio_id
      LEFT JOIN public.libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN public.ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
      WHERE m.comercio_id = $1
    `;

    const params = [comercioId];

    if (sucursalObjetivo) {
      params.push(parseInt(sucursalObjetivo, 10));
      sql += ` AND m.sucursal_id = $${params.length}`;
    }

    if (fechaInicio && fechaInicio.trim() !== '') {
      params.push(fechaInicio.trim());
      sql += ` AND m.fecha::DATE >= $${params.length}::DATE`;
    }

    if (fechaFin && fechaFin.trim() !== '') {
      params.push(fechaFin.trim());
      sql += ` AND m.fecha::DATE <= $${params.length}::DATE`;
    }

    sql += ` ORDER BY m.fecha DESC`;

    const result = await db.query(sql, params);
    const rows = result.rows.map(r => ({
      ...r,
      cantidad: Number(r.cantidad) || 0,
      precio_unitario: Number(r.precio_unitario) || 0,
      total: Number(r.total) || 0
    }));
    res.json(rows);
  } catch (error) {
    console.error('❌ Error obteniendo movimientos:', error);
    res.status(500).json({ error: 'Error interno al consultar movimientos' });
  }
};

// GET /api/estadisticas
const obtenerEstadisticas = async (req, res) => {
  try {
    const { periodo = '7d', sucursal_id, sucursalId } = req.query;
    const comercioId = req.usuario?.comercio_id;
    const sucursalRaw = sucursal_id || sucursalId;

    // 🔒 1. Whitelist estricta para el período
    const periodosValidos = {
      '24h': 1,
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    const dias = periodosValidos[periodo] || 7;

    // 🔒 2. Sanitización estricta de la sucursal
    let idSucursal = null;
    if (sucursalRaw && sucursalRaw !== 'null' && sucursalRaw !== 'undefined') {
      const parsedId = parseInt(sucursalRaw, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        idSucursal = parsedId;
      }
    }

    // --- Query 1: Productos más vendidos (filtrado por comercio_id) ---
    let sqlMasVendidos = `
      SELECT 
        COALESCE(p.nombre, l.titulo, r.nombre, m.producto_nombre, 'Producto') AS nombre,
        SUM(m.cantidad)::NUMERIC(10,3) AS cantidad
      FROM public.movimientos m
      LEFT JOIN public.productos p ON m.producto_unificado_id = p.id
      LEFT JOIN public.libros l ON m.tipo_producto = 'libro' AND m.producto_id = l.id
      LEFT JOIN public.ropa r ON m.tipo_producto = 'ropa' AND m.producto_id = r.id
      WHERE m.tipo_movimiento = 'venta'
        AND m.comercio_id = $1
        AND m.fecha >= NOW() - ($2 * INTERVAL '1 day')
    `;

    const paramsMasVendidos = [comercioId, dias];
    if (idSucursal) {
      paramsMasVendidos.push(idSucursal);
      sqlMasVendidos += ` AND m.sucursal_id = $${paramsMasVendidos.length}`;
    }

    sqlMasVendidos += `
      GROUP BY COALESCE(p.nombre, l.titulo, r.nombre, m.producto_nombre, 'Producto')
      ORDER BY cantidad DESC
      LIMIT 10
    `;

    const resMasVendidos = await db.query(sqlMasVendidos, paramsMasVendidos);

    // --- Query 2: Tendencia de ventas diaria (filtrado por comercio_id) ---
    let sqlVentasDiarias = `
      SELECT 
        TO_CHAR(m.fecha, 'DD/MM') AS fecha,
        SUM(m.cantidad * m.precio_unitario * (1 - (COALESCE(m.descuento_porcentaje, 0) / 100.0)))::NUMERIC(10,2) AS total
      FROM public.movimientos m
      WHERE m.tipo_movimiento = 'venta'
        AND m.comercio_id = $1
        AND m.fecha >= NOW() - ($2 * INTERVAL '1 day')
    `;

    const paramsDiarias = [comercioId, dias];
    if (idSucursal) {
      paramsDiarias.push(idSucursal);
      sqlVentasDiarias += ` AND m.sucursal_id = $${paramsDiarias.length}`;
    }

    sqlVentasDiarias += `
      GROUP BY TO_CHAR(m.fecha, 'DD/MM'), DATE(m.fecha)
      ORDER BY DATE(m.fecha) ASC
    `;

    const resVentasDiarias = await db.query(sqlVentasDiarias, paramsDiarias);

    // --- Query 3: Alertas de stock crítico (filtrado por comercio_id) ---
    let sqlAlertas = `
      SELECT 
        st.id,
        st.cantidad,
        st.stock_minimo,
        s.nombre AS sucursal_nombre,
        COALESCE(p.nombre, l.titulo, r.nombre, 'Producto') AS nombre_producto,
        COALESCE(p.es_pesable, false) AS es_pesable,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida
      FROM public.stock st
      LEFT JOIN public.sucursales s ON st.sucursal_id = s.id
      LEFT JOIN public.productos p ON st.producto_unificado_id = p.id AND st.comercio_id = p.comercio_id
      LEFT JOIN public.libros l ON st.tipo_producto = 'libro' AND st.producto_id = l.id
      LEFT JOIN public.ropa r ON st.tipo_producto = 'ropa' AND st.producto_id = r.id
      WHERE st.comercio_id = $1
        AND st.cantidad <= st.stock_minimo
        AND (p.activo = true OR (p.id IS NULL AND (COALESCE(l.activo, true) = true AND COALESCE(r.activo, true) = true)))
    `;

    const paramsAlertas = [comercioId];
    if (idSucursal) {
      paramsAlertas.push(idSucursal);
      sqlAlertas += ` AND st.sucursal_id = $${paramsAlertas.length}`;
    }

    sqlAlertas += ` ORDER BY st.cantidad ASC LIMIT 20`;

    const resAlertas = await db.query(sqlAlertas, paramsAlertas);

    return res.json({
      masVendidos: resMasVendidos.rows.map(r => ({
        ...r,
        cantidad: Number(r.cantidad) || 0
      })),
      ventasDiarias: resVentasDiarias.rows.map(r => ({
        ...r,
        total: Number(r.total) || 0
      })),
      alertasStock: resAlertas.rows.map(r => ({
        ...r,
        cantidad: Number(r.cantidad) || 0,
        stock_minimo: Number(r.stock_minimo) || 0
      }))
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
    return res.status(500).json({ error: 'Error interno al consultar estadísticas' });
  }
};

module.exports = {
  obtenerVentas,
  obtenerCompras,
  obtenerStockActual,
  obtenerMovimientos,
  obtenerEstadisticas,
};
