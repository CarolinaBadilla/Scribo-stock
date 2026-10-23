const db = require('../config/db');

// backend/src/controllers/productosController.js

const buscarProductoPorCodigo = async (req, res) => {
  try {
    const { codigo, sucursal } = req.query;
    // Lee 'sucursal' o 'sucursalId' y fallback a la sucursal del token
    const sucursalId = sucursal || req.query.sucursalId || req.usuario?.sucursalId;

    if (!codigo) {
      return res.status(400).json({ error: 'Debe ingresar un código de producto' });
    }

    if (!sucursalId) {
      return res.status(400).json({ error: 'Debe especificar una sucursal' });
    }

    const codigoSanitizado = String(codigo).trim();

    // 1. Intentar buscar en libros vinculando directamente con el stock de esa sucursal
    const queryLibro = `
      SELECT 
        l.id AS producto_id,
        l.titulo AS nombre_producto,
        l.precio_compra,
        l.precio_efectivo,
        l.precio_tarjeta,
        l.autor,
        l.editorial,
        COALESCE(s.cantidad, 0) AS cantidad,
        COALESCE(s.stock_minimo, 0) AS stock_minimo,
        'libro' AS tipo_producto
      FROM libros l
      JOIN stock s ON s.producto_id = l.id 
                   AND s.tipo_producto = 'libro' 
                   AND s.sucursal_id = $1
      WHERE TRIM(l.codigo_barras) = $2
      LIMIT 1
    `;

    let result = await db.query(queryLibro, [Number(sucursalId), codigoSanitizado]);

    // 2. Si no es libro, intentar buscar en ropa (o productos generales)
    if (result.rows.length === 0) {
      const queryRopa = `
        SELECT 
          r.id AS producto_id,
          r.nombre AS nombre_producto,
          r.precio_compra,
          r.precio_efectivo,
          r.precio_tarjeta,
          COALESCE(s.cantidad, 0) AS cantidad,
          COALESCE(s.stock_minimo, 0) AS stock_minimo,
          'ropa' AS tipo_producto
        FROM ropa r
        JOIN stock s ON s.producto_id = r.id 
                     AND s.tipo_producto = 'ropa' 
                     AND s.sucursal_id = $1
        WHERE TRIM(r.codigo) = $2 OR TRIM(r.codigo_barras) = $2
        LIMIT 1
      `;
      result = await db.query(queryRopa, [Number(sucursalId), codigoSanitizado]);
    }

    // 3. Fallback: si no tiene registro de stock aún en esa sucursal, buscarlo en el catálogo general
    if (result.rows.length === 0) {
      const queryCatalogo = `
        SELECT 
          l.id AS producto_id,
          l.titulo AS nombre_producto,
          l.precio_compra,
          l.precio_efectivo,
          l.precio_tarjeta,
          0 AS cantidad,
          0 AS stock_minimo,
          'libro' AS tipo_producto
        FROM libros l
        WHERE TRIM(l.codigo_barras) = $1
        LIMIT 1
      `;
      result = await db.query(queryCatalogo, [codigoSanitizado]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const producto = result.rows[0];

    // Ocultar precio_compra si el usuario no es jefe ni dueño
    if (req.usuario?.rol !== 'jefe' && req.usuario?.rol !== 'DUENO') {
      delete producto.precio_compra;
    }

    return res.json(producto);

  } catch (error) {
    console.error('Error al buscar producto:', error);
    return res.status(500).json({ error: 'Error interno al buscar producto' });
  }
};


const crearProducto = async (req, res) => {
  const tipoNormalizado = req.body.tipo ? req.body.tipo.toString().trim().toLowerCase() : '';

  const { 
    codigo_barras, 
    nombre, 
    autor, 
    editorial, 
    colegio, 
    talle, 
    color, 
    precio_compra, 
    precio_efectivo, 
    precio_tarjeta,
    sucursal_id,
    cantidad_inicial = 0 
  } = req.body;

  try {
    let nuevoProductoId;

    if (tipoNormalizado === 'libro') {
      const resultLibro = await db.query(
        `INSERT INTO libros (codigo_barras, titulo, autor, editorial, precio_compra, precio_efectivo, precio_tarjeta)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [codigo_barras, nombre, autor, editorial, precio_compra || 0, precio_efectivo || 0, precio_tarjeta || 0]
      );
      nuevoProductoId = resultLibro.rows[0].id;
    } else if (tipoNormalizado === 'ropa') {
      const resultRopa = await db.query(
        `INSERT INTO ropa (codigo_barras, nombre, colegio, talle, color, precio_compra, precio_efectivo, precio_tarjeta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [codigo_barras, nombre, colegio || '', talle, color, precio_compra || 0, precio_efectivo || 0, precio_tarjeta || 0]
      );
      nuevoProductoId = resultRopa.rows[0].id;
    } else {
      return res.status(400).json({ error: 'El tipo de producto debe ser "libro" o "ropa"' });
    }

    if (sucursal_id) {
      await db.query(
        `INSERT INTO stock (tipo_producto, producto_id, sucursal_id, cantidad, stock_minimo)
         VALUES ($1, $2, $3, $4, 5)
         ON CONFLICT (tipo_producto, producto_id, sucursal_id) 
         DO UPDATE SET cantidad = stock.cantidad + EXCLUDED.cantidad`,
        [tipoNormalizado, nuevoProductoId, sucursal_id, cantidad_inicial]
      );
    }

    res.status(201).json({ 
      mensaje: 'Producto creado exitosamente', 
      id: nuevoProductoId 
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al registrar el producto en la base de datos' });
  }
};


const actualizarProducto = async (req, res) => {
  const { tipo, id } = req.params;
  const tipoNormalizado = tipo ? tipo.toString().trim().toLowerCase() : '';

  const { 
    codigo_barras, 
    nombre, 
    autor, 
    editorial, 
    colegio, 
    talle, 
    color, 
    precio_compra, 
    precio_efectivo, 
    precio_tarjeta 
  } = req.body;

  try {
    if (tipoNormalizado === 'libro') {
      const result = await db.query(
        `UPDATE libros 
         SET codigo_barras = COALESCE(NULLIF($1, ''), codigo_barras),
             titulo = COALESCE(NULLIF($2, ''), titulo),
             autor = COALESCE(NULLIF($3, ''), autor),
             editorial = COALESCE(NULLIF($4, ''), editorial),
             precio_efectivo = COALESCE($5, precio_efectivo),
             precio_tarjeta = COALESCE($6, precio_tarjeta),
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          codigo_barras ? codigo_barras.trim() : null,
          nombre || null,
          autor || null,
          editorial || null,
          precio_efectivo !== undefined && precio_efectivo !== '' ? parseFloat(precio_efectivo) : null,
          precio_tarjeta !== undefined && precio_tarjeta !== '' ? parseFloat(precio_tarjeta) : null,
          parseInt(id, 10)
        ]
      );

      if (result.rowCount === 0) return res.status(404).json({ error: 'Libro no encontrado' });
      return res.json({ mensaje: 'Libro actualizado correctamente', producto: result.rows[0] });

    } else if (tipoNormalizado === 'ropa') {
      const result = await db.query(
        `UPDATE ropa 
         SET codigo_barras = COALESCE(NULLIF($1, ''), codigo_barras),
             nombre = COALESCE(NULLIF($2, ''), nombre),
             colegio = COALESCE(NULLIF($3, ''), colegio),
             talle = COALESCE(NULLIF($4, ''), talle),
             color = COALESCE(NULLIF($5, ''), color),
             precio_compra = COALESCE($6, precio_compra),
             precio_efectivo = COALESCE($7, precio_efectivo),
             precio_tarjeta = COALESCE($8, precio_tarjeta),
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          codigo_barras ? codigo_barras.trim() : null,
          nombre || null,
          colegio || null,
          talle || null,
          color || null,
          precio_compra !== undefined && precio_compra !== '' ? parseFloat(precio_compra) : null,
          precio_efectivo !== undefined && precio_efectivo !== '' ? parseFloat(precio_efectivo) : null,
          precio_tarjeta !== undefined && precio_tarjeta !== '' ? parseFloat(precio_tarjeta) : null,
          parseInt(id, 10)
        ]
      );

      if (result.rowCount === 0) return res.status(404).json({ error: 'Prenda no encontrada' });
      return res.json({ mensaje: 'Producto actualizado correctamente', producto: result.rows[0] });
    } else {
      return res.status(400).json({ error: 'Tipo inválido' });
    }
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};

// DELETE /api/productos/:tipo/:id
const eliminarProducto = async (req, res) => {
  const { tipo, id } = req.params;
  const tipoNormalizado = tipo ? tipo.toString().trim().toLowerCase() : '';
  const productoId = parseInt(id, 10);

  try {
    // 1. Eliminamos de la tabla stock para que no ocupe lugar en el inventario activo
    await db.query(
      `DELETE FROM stock WHERE tipo_producto = $1 AND producto_id = $2`,
      [tipoNormalizado, productoId]
    );

    // 2. En lugar de DELETE, hacemos un borrado lógico (Soft Delete) en la tabla del producto
    let result;
    if (tipoNormalizado === 'libro') {
      result = await db.query(
        `UPDATE libros SET activo = FALSE, updated_at = NOW() WHERE id = $1`,
        [productoId]
      );
    } else if (tipoNormalizado === 'ropa') {
      result = await db.query(
        `UPDATE ropa SET activo = FALSE, updated_at = NOW() WHERE id = $1`,
        [productoId]
      );
    } else {
      return res.status(400).json({ error: 'Tipo de producto inválido' });
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto dado de baja correctamente' });
  } catch (error) {
    console.error('Error al dar de baja producto:', error);
    res.status(500).json({ error: 'Error al procesar la baja del producto' });
  }
};

module.exports = {
  buscarProductoPorCodigo,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};