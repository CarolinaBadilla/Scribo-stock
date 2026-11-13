const { pool } = require('../config/db');

const registrarCompra = async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    const { sucursalId, items } = req.body;
    const comercioId = req.usuario?.comercio_id;
    const usuarioId = req.usuario?.id;
    const movimientos = [];

    await client.query('BEGIN'); // Iniciar transacción SQL

    // Validar que la sucursal pertenece al comercio
    const sucRes = await client.query(
      'SELECT id FROM public.sucursales WHERE id = $1 AND comercio_id = $2',
      [parseInt(sucursalId, 10), comercioId]
    );
    if (sucRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'La sucursal no pertenece a tu comercio' });
    }

    for (const item of items) {
      const tipo = (item.tipoProducto || 'general').toString().trim().toLowerCase();
      const rawProdId = item.producto_unificado_id || item.productoId;
      const cant = Number(item.cantidad) || 0;
      const precioCompra = parseFloat(item.precioCompra) || 0;

      let productoUnificadoId = null;
      let prodNombre = 'Producto Compra';

      // 1. Buscar en public.productos
      const prodCheck = await client.query(
        'SELECT id, nombre FROM public.productos WHERE id = $1 AND comercio_id = $2',
        [rawProdId, comercioId]
      );

      if (prodCheck.rows.length > 0) {
        productoUnificadoId = prodCheck.rows[0].id;
        prodNombre = prodCheck.rows[0].nombre;
        // Actualizar precio_compra en public.productos
        await client.query(
          'UPDATE public.productos SET precio_compra = $1, updated_at = NOW() WHERE id = $2 AND comercio_id = $3',
          [precioCompra, productoUnificadoId, comercioId]
        );
      } else {
        // Fallback tablas legacy si aún no migró
        if (tipo === 'libro') {
          const lRes = await client.query('UPDATE libros SET precio_compra = $1, updated_at = NOW() WHERE id = $2 RETURNING titulo', [precioCompra, rawProdId]);
          if (lRes.rows.length > 0) prodNombre = lRes.rows[0].titulo;
        } else if (tipo === 'ropa') {
          const rRes = await client.query('UPDATE ropa SET precio_compra = $1, updated_at = NOW() WHERE id = $2 RETURNING nombre', [precioCompra, rawProdId]);
          if (rRes.rows.length > 0) prodNombre = rRes.rows[0].nombre;
        }
      }

      // 2. Insertar movimiento de tipo 'compra'
      const insertMovimientoSql = `
        INSERT INTO public.movimientos (
          comercio_id, producto_unificado_id, tipo_producto, producto_id, 
          sucursal_id, tipo_movimiento, cantidad, precio_unitario, 
          usuario_id, producto_nombre, fecha
        ) VALUES ($1, $2, $3, $4, $5, 'compra', $6, $7, $8, $9, NOW())
        RETURNING *;
      `;

      const valuesMov = [
        comercioId,
        productoUnificadoId,
        tipo,
        rawProdId,
        parseInt(sucursalId, 10),
        cant,
        precioCompra,
        usuarioId || null,
        prodNombre
      ];

      const movRes = await client.query(insertMovimientoSql, valuesMov);
      movimientos.push(movRes.rows[0]);

      // 3. Incrementar stock de forma atómica para el comercio
      const targetProdId = productoUnificadoId || rawProdId;
      const checkStock = await client.query(
        `SELECT id FROM public.stock 
         WHERE comercio_id = $1 AND sucursal_id = $2 
           AND producto_unificado_id = $3`,
        [comercioId, parseInt(sucursalId, 10), parseInt(targetProdId, 10)]
      );

      if (checkStock.rows.length > 0) {
        await client.query(
          `UPDATE public.stock 
           SET cantidad = cantidad + $1, updated_at = NOW() 
           WHERE id = $2`,
          [cant, checkStock.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO public.stock (
             comercio_id, producto_unificado_id, producto_id, tipo_producto, 
             sucursal_id, cantidad, stock_minimo, updated_at
           ) VALUES ($1, $2, $2, $3, $4, $5, 5, NOW())`,
          [comercioId, parseInt(targetProdId, 10), tipo, parseInt(sucursalId, 10), cant]
        );
      }
    }

    await client.query('COMMIT'); // Confirmar cambios

    res.json({
      success: true,
      message: 'Compra registrada y stock actualizado correctamente',
      movimientos
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK'); // Deshacer si falla
    console.error('❌ Error registrando compra:', error);
    res.status(500).json({ error: 'Ocurrió un error interno en el servidor al registrar la compra' });
  } finally {
    if (client) client.release(); // Liberar cliente al pool
  }
};

module.exports = {
  registrarCompra
};
