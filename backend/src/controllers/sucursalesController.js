const db = require('../config/db');

// GET /api/sucursales
const obtenerSucursales = async (req, res) => {
  try {
    const comercioId = req.usuario?.comercio_id;
    const sql = `
      SELECT id, comercio_id, nombre, direccion, mp_external_store_id, mp_external_pos_id, created_at 
      FROM sucursales 
      WHERE comercio_id = $1
      ORDER BY id ASC;
    `;
    const result = await db.query(sql, [comercioId]);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo sucursales:', error);
    res.status(500).json({ error: 'Error interno al consultar sucursales' });
  }
};

// GET /api/sucursales/:id
const obtenerSucursalPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const comercioId = req.usuario?.comercio_id;
    const sql = `
      SELECT id, comercio_id, nombre, direccion, mp_external_store_id, mp_external_pos_id, created_at 
      FROM sucursales 
      WHERE id = $1 AND comercio_id = $2;
    `;
    const result = await db.query(sql, [parseInt(id, 10), comercioId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada o no pertenece a tu comercio' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error obteniendo sucursal por ID:', error);
    res.status(500).json({ error: 'Error interno al consultar sucursal' });
  }
};

// POST /api/sucursales
const crearSucursal = async (req, res) => {
  try {
    const { nombre, direccion } = req.body;
    const comercioId = req.usuario?.comercio_id;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la sucursal es obligatorio' });
    }

    const sql = `
      INSERT INTO sucursales (comercio_id, nombre, direccion)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await db.query(sql, [comercioId, nombre.trim(), direccion ? direccion.trim() : null]);

    res.status(201).json({
      success: true,
      message: 'Sucursal creada exitosamente',
      sucursal: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error creando sucursal:', error);
    res.status(500).json({ error: 'Error interno al crear sucursal' });
  }
};

// PUT /api/sucursales/:id
const actualizarSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion } = req.body;
    const comercioId = req.usuario?.comercio_id;

    const sql = `
      UPDATE sucursales
      SET nombre = COALESCE($1, nombre),
          direccion = COALESCE($2, direccion)
      WHERE id = $3 AND comercio_id = $4
      RETURNING *;
    `;
    const result = await db.query(sql, [
      nombre ? nombre.trim() : null, 
      direccion !== undefined ? (direccion ? direccion.trim() : null) : null, 
      parseInt(id, 10), 
      comercioId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada o no pertenece a tu comercio' });
    }

    res.json({
      success: true,
      message: 'Sucursal actualizada exitosamente',
      sucursal: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error actualizando sucursal:', error);
    res.status(500).json({ error: 'Error interno al actualizar sucursal' });
  }
};

module.exports = {
  obtenerSucursales,
  obtenerSucursalPorId,
  crearSucursal,
  actualizarSucursal,
};
