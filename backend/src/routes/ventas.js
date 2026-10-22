// backend/src/routes/ventas.js
const express = require('express');
const { pool } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { registrarVentaSchema } = require('../schemas/ventasSchema');

const router = express.Router();

router.post('/registrar', verificarToken, validar(registrarVentaSchema), async (req, res) => {
  const client = await pool.connect();

  try {
    const { sucursalId, tipoPago, items } = req.body;
    const usuarioId = req.usuario.id; // Extraído de forma segura desde el JWT

    const movimientos = [];
    await client.query('BEGIN'); // Transacción SQL atómica

    for (const item of items) {
      const tipo = item.tipoProducto.toLowerCase();
      const prodId = item.productoId;
      const cantidad = item.cantidad;
      let descuento = item.descuento || 0;

      // Restricción de permisos para descuentos elevados
      if (descuento > 50 && req.usuario.rol !== 'jefe' && req.usuario.rol !== 'DUENO') {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          error: `El descuento del ${descuento}% requiere autorización de un administrador` 
        });
      }

      // 1. Obtener precio oficial desde la base de datos
      const queryTabla = tipo === 'libro' ? 'libros' : 'ropa';
      const colNombre = tipo === 'libro' ? 'titulo' : 'nombre';

      const prodRes = await client.query(
        `SELECT ${colNombre} AS nombre, precio_efectivo, precio_tarjeta 
         FROM ${queryTabla} 
         WHERE id = $1 AND (activo = TRUE OR activo IS NULL)`,
        [prodId]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${tipo} ID ${prodId} no disponible o dado de baja` });
      }

      const prodDb = prodRes.rows[0];
      const precioOficial = tipoPago === 'efectivo'
        ? Number(prodDb.precio_efectivo)
        : Number(prodDb.precio_tarjeta || prodDb.precio_efectivo);

      // 2. Comprobar stock con bloqueo de fila (FOR UPDATE) para prevenir condiciones de carrera
      const stockRes = await client.query(
        'SELECT cantidad FROM stock WHERE tipo_producto = $1 AND producto_id = $2 AND sucursal_id = $3 FOR UPDATE',
        [tipo, prodId, sucursalId]
      );

      const stockDisponible = stockRes.rows.length > 0 ? stockRes.rows[0].cantidad : 0;
      if (stockDisponible < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Stock insuficiente para "${prodDb.nombre}". Disponible: ${stockDisponible}, Solicitado: ${cantidad}` 
        });
      }

      // 3. Registrar movimiento auditado
      const insertQuery = `
        INSERT INTO movimientos (
          tipo_producto, producto_id, sucursal_id, tipo_movimiento, 
          cantidad, precio_unitario, descuento_porcentaje, usuario_id, producto_nombre
        ) VALUES ($1, $2, $3, 'venta', $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        tipo,
        prodId,
        sucursalId,
        cantidad,
        precioOficial,
        descuento,
        usuarioId,
        prodDb.nombre
      ];

      const movRes = await client.query(insertQuery, values);
      movimientos.push(movRes.rows[0]);

      // 4. Actualizar stock
      await client.query(
        `UPDATE stock 
         SET cantidad = cantidad - $1, updated_at = NOW() 
         WHERE tipo_producto = $2 AND producto_id = $3 AND sucursal_id = $4`,
        [cantidad, tipo, prodId, sucursalId]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Venta registrada con precios validados por el servidor',
      movimientos
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Error en venta:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor al procesar la venta' });
  } finally {
    client.release();
  }
});

module.exports = router;