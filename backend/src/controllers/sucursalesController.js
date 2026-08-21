const db = require('../config/db');

// GET /api/sucursales
const obtenerSucursales = async (req, res) => {
  try {
    const sql = `
      SELECT id, nombre, direccion, created_at 
      FROM sucursales 
      ORDER BY id ASC;
    `;
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error obteniendo sucursales:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/sucursales/:id
const obtenerSucursalPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT id, nombre, direccion, created_at 
      FROM sucursales 
      WHERE id = $1;
    `;
    const result = await db.query(sql, [parseInt(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error obteniendo sucursal por ID:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/sucursales
const crearSucursal = async (req, res) => {
  try {
    const { nombre, direccion } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la sucursal es obligatorio' });
    }

    const sql = `
      INSERT INTO sucursales (nombre, direccion)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await db.query(sql, [nombre, direccion || null]);

    res.status(201).json({
      success: true,
      message: 'Sucursal creada exitosamente',
      sucursal: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error creando sucursal:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/sucursales/:id
const actualizarSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion } = req.body;

    const sql = `
      UPDATE sucursales
      SET nombre = COALESCE($1, nombre),
          direccion = COALESCE($2, direccion)
      WHERE id = $3
      RETURNING *;
    `;
    const result = await db.query(sql, [nombre, direccion, parseInt(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    res.json({
      success: true,
      message: 'Sucursal actualizada exitosamente',
      sucursal: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error actualizando sucursal:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  obtenerSucursales,
  obtenerSucursalPorId,
  crearSucursal,
  actualizarSucursal,
};