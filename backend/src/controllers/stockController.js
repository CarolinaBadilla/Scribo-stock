// backend/src/controllers/stockController.js
const db = require('../config/db');

// GET /api/stock/por-sucursal/:sucursalId o /api/stock?sucursalId=1
const obtenerStockPorSucursal = async (req, res) => {
  try {
    const sucursalId = req.params.sucursalId || req.query.sucursalId;
    const comercioId = req.usuario?.comercio_id;

    let sql = `
      SELECT 
        st.id,
        COALESCE(p.categoria, st.tipo_producto) AS tipo_producto,
        COALESCE(p.categoria, st.tipo_producto) AS categoria,
        COALESCE(st.producto_unificado_id, st.producto_id) AS producto_id,
        st.producto_unificado_id,
        st.sucursal_id,
        st.cantidad,
        st.stock_minimo,
        s.nombre AS sucursal_nombre,
        COALESCE(p.nombre, l.titulo, r.nombre, 'Producto') AS nombre_producto,
        COALESCE(p.codigo_barras, l.codigo_barras, r.codigo_barras, '') AS codigo_barras,
        COALESCE(p.precio_efectivo, l.precio_efectivo, r.precio_efectivo, 0) AS precio_efectivo,
        COALESCE(p.precio_tarjeta, l.precio_tarjeta, r.precio_tarjeta, 0) AS precio_tarjeta,
        COALESCE(p.es_pesable, false) AS es_pesable,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        p.codigo_plu,
        p.atributos,
        CASE 
          WHEN p.id IS NOT NULL AND p.atributos IS NOT NULL AND p.atributos != '{}'::jsonb THEN p.atributos::text
          WHEN st.tipo_producto = 'libro' THEN COALESCE(l.editorial, '-')
          WHEN st.tipo_producto = 'ropa' THEN COALESCE(r.talle || ' / ' || r.color, '-')
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
    console.error('❌ Error obteniendo stock:', error);
    res.status(500).json({ error: 'Ocurrió un error interno en el servidor al consultar stock' });
  }
};

// PUT /api/stock/actualizar
const actualizarCantidadStock = async (req, res) => {
  try {
    const { tipoProducto, productoId, producto_unificado_id, sucursalId, cantidad, stockMinimo } = req.body;
    const comercioId = req.usuario?.comercio_id;

    const prodId = producto_unificado_id || productoId;
    if (!prodId || !sucursalId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (productoId, sucursalId)' });
    }

    const cantDecimal = Number(cantidad) || 0;
    const stockMinDecimal = stockMinimo ? Number(stockMinimo) : 5;
    const tipo = (tipoProducto || 'general').toLowerCase();

    // Buscar si ya existe la fila en stock exclusivamente por producto_unificado_id, sucursal_id y comercio_id
    const checkStock = await db.query(
      `SELECT id FROM public.stock 
       WHERE comercio_id = $1 AND sucursal_id = $2 
         AND producto_unificado_id = $3`,
      [comercioId, parseInt(sucursalId, 10), parseInt(prodId, 10)]
    );

    let stockFila;
    if (checkStock.rows.length > 0) {
      const updateRes = await db.query(
        `UPDATE public.stock 
         SET cantidad = $1, stock_minimo = COALESCE($2, stock_minimo), updated_at = NOW() 
         WHERE id = $3 
         RETURNING *`,
        [cantDecimal, stockMinDecimal, checkStock.rows[0].id]
      );
      stockFila = updateRes.rows[0];
    } else {
      const insertRes = await db.query(
        `INSERT INTO public.stock (
           comercio_id, producto_unificado_id, producto_id, tipo_producto, 
           sucursal_id, cantidad, stock_minimo, updated_at
         ) VALUES ($1, $2, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [comercioId, parseInt(prodId, 10), tipo, parseInt(sucursalId, 10), cantDecimal, stockMinDecimal]
      );
      stockFila = insertRes.rows[0];
    }

    res.json({
      success: true,
      message: 'Stock actualizado correctamente',
      stock: stockFila
    });
  } catch (error) {
    console.error('❌ Error actualizando stock:', error);
    res.status(500).json({ error: 'Ocurrió un error interno en el servidor al actualizar stock' });
  }
};

// GET /api/stock/alertas?sucursalId=1
const obtenerAlertasStockBajo = async (req, res) => {
  try {
    const { sucursalId } = req.query;
    const comercioId = req.usuario?.comercio_id;

    let sql = `
      SELECT 
        st.id,
        COALESCE(p.categoria, st.tipo_producto) AS tipo_producto,
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
      stock_minimo: Number(r.stock_minimo) || 0
    }));
    res.json(rows);
  } catch (error) {
    console.error('❌ Error consultando alertas de stock:', error);
    res.status(500).json({ error: 'Ocurrió un error interno en el servidor al consultar alertas' });
  }
};

module.exports = {
  obtenerStockPorSucursal,
  actualizarCantidadStock,
  obtenerAlertasStockBajo
};
