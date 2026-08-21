const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_scribo_2026';

// POST /api/autenticacion/iniciar-sesion
const iniciarSesion = async (req, res) => {
  try {
    const { usuario, email, clave } = req.body;
    const identificador = usuario || email;

    if (!identificador || !clave) {
      return res.status(400).json({ error: 'Debes proporcionar usuario/email y contraseña' });
    }

    // 1. Buscar directamente en la tabla usuarios (permite login por email o nombre de usuario)
    const result = await db.query(
      `SELECT u.id, u.usuario, u.email, u.clave, u.rol, u.sucursal_id, s.nombre as sucursal_nombre 
       FROM usuarios u 
       LEFT JOIN sucursales s ON u.sucursal_id = s.id 
       WHERE u.email = $1 OR u.usuario = $1 
       LIMIT 1`,
      [identificador]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas (usuario no encontrado)' });
    }

    const usuarioDb = result.rows[0];

    // 2. Comparar la contraseña ingresada con el hash guardado en 'clave'
    const passwordValida = await bcrypt.compare(clave, usuarioDb.clave);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas (contraseña incorrecta)' });
    }

    // 3. Estructura de respuesta limpia para el frontend
    const usuarioRespuesta = {
      id: usuarioDb.id,
      email: usuarioDb.email,
      usuario: usuarioDb.usuario,
      rol: usuarioDb.rol,
      sucursalId: usuarioDb.sucursal_id || 1,
      sucursalNombre: usuarioDb.sucursal_nombre || 'Casa Central'
    };

    // 4. Firmar el Token JWT
    const token = jwt.sign(usuarioRespuesta, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      success: true,
      token,
      usuario: usuarioRespuesta
    });
  } catch (error) {
    console.error('❌ Error en inicio de sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión' });
  }
};

const obtenerPerfil = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    const decodificado = jwt.verify(token, JWT_SECRET);
    return res.json(decodificado);
  } catch (error) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido' });
  }
};

const cerrarSesion = async (req, res) => {
  return res.json({ success: true, message: 'Sesión cerrada correctamente' });
};

module.exports = {
  iniciarSesion,
  obtenerPerfil,
  cerrarSesion
};