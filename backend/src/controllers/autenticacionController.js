const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mitigación de Timing Attacks: hash precalculado para igualar el tiempo de cómputo
const DUMMY_HASH = bcrypt.hashSync('mitigacion-timing-attack', 10);

// Fail-Fast: Si falta la variable de entorno o es débil, el backend no debe operar
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET no está definido o es menor a 32 caracteres');
}

// POST /api/autenticacion/iniciar-sesion
const iniciarSesion = async (req, res) => {
  try {
    const { usuario, email, clave } = req.body;
    const identificador = (usuario || email || '').toLowerCase().trim();

    if (!identificador || !clave) {
      return res.status(400).json({ error: 'Debes proporcionar usuario/email y contraseña' });
    }

    // 1. Buscar directamente en la tabla usuarios
    const result = await db.query(
      `SELECT u.id, u.usuario, u.email, u.clave, u.rol, u.sucursal_id, s.nombre as sucursal_nombre 
       FROM usuarios u 
       LEFT JOIN sucursales s ON u.sucursal_id = s.id 
       WHERE LOWER(u.email) = $1 OR LOWER(u.usuario) = $1 
       LIMIT 1`,
      [identificador]
    );

    const usuarioDb = result.rows[0];

    // 2. Comparar siempre con bcrypt (incluso si no existe el usuario) para mitigar Timing Attacks
    const hashParaComparar = usuarioDb ? usuarioDb.clave : DUMMY_HASH;
    const passwordValida = await bcrypt.compare(clave, hashParaComparar);

    // Mensaje unificado: nunca revelar si falló el usuario o la clave
    if (!usuarioDb || !passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 3. Control de acceso por sucursal: los operadores DEBEN tener sucursal asignada
    const esJefeODueno = usuarioDb.rol === 'jefe' || usuarioDb.rol === 'DUENO';
    if (!esJefeODueno && !usuarioDb.sucursal_id) {
      return res.status(403).json({ 
        error: 'Tu usuario no tiene una sucursal asignada. Contacta al administrador.' 
      });
    }

    // 4. Estructura del payload para el token
    const usuarioRespuesta = {
      id: usuarioDb.id,
      email: usuarioDb.email,
      usuario: usuarioDb.usuario,
      rol: usuarioDb.rol,
      sucursalId: usuarioDb.sucursal_id || null,
      sucursalNombre: usuarioDb.sucursal_nombre || (esJefeODueno ? 'Todas las sucursales' : 'Sin asignar')
    };

    // 5. Firmar el Token JWT fijando el algoritmo HS256
    const token = jwt.sign(usuarioRespuesta, JWT_SECRET, { 
      algorithm: 'HS256',
      expiresIn: '8h' 
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

const obtenerPerfil = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    const decodificado = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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