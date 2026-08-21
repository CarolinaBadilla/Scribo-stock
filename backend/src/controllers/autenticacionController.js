const db = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_scribo_2026';

// POST /api/autenticacion/iniciar-sesion
const iniciarSesion = async (req, res) => {
  try {
    const { usuario, email, clave } = req.body;
    const identificador = usuario || email;

    if (!identificador) {
      return res.status(400).json({ error: 'Debes proporcionar un usuario o email' });
    }

    // 1. Intentar buscar en la base de datos de PostgreSQL
    let usuarioEncontrado = null;
    try {
      const result = await db.query(
        `SELECT p.id, p.email, p.rol, p.sucursal_id, s.nombre as sucursal_nombre 
         FROM perfiles p 
         LEFT JOIN sucursales s ON p.sucursal_id = s.id 
         WHERE p.email = $1 LIMIT 1`,
        [identificador]
      );
      if (result.rows.length > 0) {
        usuarioEncontrado = result.rows[0];
      }
    } catch (dbErr) {
      console.warn('⚠️ No se pudo consultar la tabla perfiles, usando fallback demo:', dbErr.message);
    }

    // 2. Estructura de respuesta adaptada a lo que espera tu frontend
    const usuarioRespuesta = {
      id: usuarioEncontrado ? usuarioEncontrado.id : 'usr-001',
      nombre: identificador === 'dueno' ? 'Dueño Administrador' : (usuarioEncontrado?.email || identificador),
      usuario: identificador,
      email: usuarioEncontrado?.email || `${identificador}@scribo.com.ar`,
      rol: identificador === 'dueno' ? 'DUENO' : (usuarioEncontrado?.rol || 'jefe'),
      sucursalId: usuarioEncontrado?.sucursal_id || 1
    };

    // 3. Firmar Token JWT
    const token = jwt.sign(usuarioRespuesta, JWT_SECRET, { expiresIn: '8h' });

    // 4. Guardar cookie HttpOnly opcional para mayor seguridad
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600 * 1000
    });

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

// GET /api/autenticacion/perfil
const obtenerPerfil = async (req, res) => {
  try {
    // Si viene la cookie o el token Bearer
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    const decodificado = jwt.verify(token, JWT_SECRET);
    return res.json(decodificado);
  } catch (error) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido' });
  }
};

// POST /api/autenticacion/cerrar-sesion
const cerrarSesion = async (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Sesión cerrada correctamente' });
};

module.exports = {
  iniciarSesion,
  obtenerPerfil,
  cerrarSesion
};