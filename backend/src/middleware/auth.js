const jwt = require('jsonwebtoken');

// Middleware para verificar token activo
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
  }

  try {
    const usuarioDecodificado = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secreto_super_seguro_scribo_2026'
    );
    req.usuario = usuarioDecodificado; // Guardamos los datos del usuario en la request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware para restringir accesos por Rol
const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const rolUsuario = req.usuario.rol;
    if (!rolesPermitidos.includes(rolUsuario)) {
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