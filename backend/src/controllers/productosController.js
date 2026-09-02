const db = require('../config/db');

// GET /api/productos/buscar?codigo=XXX&sucursal=1
const buscarProductoPorCodigo = async (req, res) => {
  try {
    const { codigo, sucursal } = req.query;

    if (!codigo) {
      return res.status(400).json({ error: 'El código de barras es requerido' });
    }

    const sucursalId = sucursal ? parseInt(sucursal) : 1;

    // 1. Buscar en tabla 'libros'
    const libroRes = await db.query(
      'SELECT * FROM libros WHERE codigo_barras = $1 LIMIT 1',
      [codigo]
    );

    if (libroRes.rows.length > 0) {
      const libro = libroRes.rows[0];

      const stockRes = await db.query(
        'SELECT cantidad, stock_minimo FROM stock WHERE tipo_producto = $1 AND producto_id = $2 AND sucursal_id = $3 LIMIT 1',
        ['libro', libro.id, sucursalId]
      );

      const stock = stockRes.rows[0];

      return res.json({
        tipo_producto: 'libro',
        producto_id: libro.id,
        nombre_producto: libro.titulo,
        precio_efectivo: Number(libro.precio_efectivo) || 0,
        precio_tarjeta: Number(libro.precio_tarjeta) || Number(libro.precio_efectivo) || 0,
        cantidad: stock ? stock.cantidad : 0,
        stock_minimo: stock ? stock.stock_minimo : 5,
        autor: libro.autor,
        editorial: libro.editorial
      });
    }

    // 2. Buscar en tabla 'ropa'
    const ropaRes = await db.query(
      'SELECT * FROM ropa WHERE codigo_barras = $1 LIMIT 1',
      [codigo]
    );

    if (ropaRes.rows.length > 0) {
      const ropa = ropaRes.rows[0];

      const stockRes = await db.query(
        'SELECT cantidad, stock_minimo FROM stock WHERE tipo_producto = $1 AND producto_id = $2 AND sucursal_id = $3 LIMIT 1',
        ['ropa', ropa.id, sucursalId]
      );

      const stock = stockRes.rows[0];

      return res.json({
        tipo_producto: 'ropa',
        producto_id: ropa.id,
        nombre_producto: ropa.nombre,
        precio_efectivo: Number(ropa.precio_efectivo) || 0,
        precio_tarjeta: Number(ropa.precio_tarjeta) || Number(ropa.precio_efectivo) || 0,
        cantidad: stock ? stock.cantidad : 0,
        stock_minimo: stock ? stock.stock_minimo : 5,
        colegio: ropa.colegio,
        talle: ropa.talle,
        color: ropa.color,
        precio_compra: ropa.precio_compra
      });
    }

    return res.status(404).json({ error: 'Producto no encontrado' });
  } catch (error) {
    console.error('❌ Error en búsqueda de producto:', error);
    res.status(500).json({ error: error.message });
  }
};

// Agregar esta función dentro de src/controllers/productosController.js

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

    // Registrar o actualizar stock inicial
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

module.exports = {
  buscarProductoPorCodigo,
  crearProducto
};