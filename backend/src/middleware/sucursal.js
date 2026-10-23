
const restringirSucursal = (req, res, next) => {
  const rol = req.usuario?.rol;
  const sucursalUsuario = req.usuario?.sucursalId;

  // Jefes y dueños pueden operar en cualquier sucursal
  if (rol === 'jefe' || rol === 'DUENO') {
    return next();
  }

  // Operadores sin sucursal asignada no pueden operar
  if (!sucursalUsuario) {
    return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
  }

  // Si la petición define una sucursal en body, params o query, debe coincidir con su token
  const sucursalSolicitada = req.body?.sucursalId || req.params?.sucursalId || req.query?.sucursalId;

  if (sucursalSolicitada && Number(sucursalSolicitada) !== Number(sucursalUsuario)) {
    return res.status(403).json({ error: 'Acceso no autorizado a otra sucursal' });
  }

  // Forzar siempre la sucursal del token en el body para prevenir manipulación
  if (req.body) {
    req.body.sucursalId = Number(sucursalUsuario);
  }

  next();
};

module.exports = { restringirSucursal };