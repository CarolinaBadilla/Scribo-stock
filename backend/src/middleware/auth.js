const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
  }

  // 🔒 SEGURIDAD: Exigir que exista la variable de entorno
  if (!process.env.JWT_SECRET) {
    console.error('CRÍTICO: JWT_SECRET no está definida en las variables de entorno');
    return res.status(500).json({ error: 'Error interno de configuración de seguridad' });
  }

  try {
    const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = usuarioDecodificado; // Guardamos datos del usuario en la request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const rolUsuario = req.usuario.rol;
    
    // Normalizamos la comparación por si vienen diferencias de mayúsculas/minúsculas
    const rolesNormalizados = rolesPermitidos.map(r => r.toLowerCase());
    const rolUsuarioNormalizado = rolUsuario ? rolUsuario.toString().toLowerCase() : '';

    if (!rolesNormalizados.includes(rolUsuarioNormalizado)) {
      return res.status(403).json({ 
        error: 'Acceso denegado: No tienes los permisos necesarios para esta acción' 
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  permitirRoles,
};