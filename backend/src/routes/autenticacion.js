const express = require('express');
const rateLimit = require('express-rate-limit');
const autenticacionController = require('../controllers/autenticacionController');
const { validar } = require('../middleware/validar');
const { loginSchema } = require('../schemas/authSchema');
const { verificarToken } = require('../middleware/auth'); // Middleware que valida el JWT

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,                  // Máximo 5 intentos fallidos
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Intente nuevamente en 15 minutos.' }
});

// Inicio de sesión protegido por Rate Limit y Zod
router.post('/iniciar-sesion', loginLimiter, validar(loginSchema), autenticacionController.iniciarSesion);

// 🔒 Validación de sesión y perfil (resuelve el 404 del frontend)
router.get('/perfil', verificarToken, autenticacionController.obtenerPerfil);

// Cierre de sesión
router.post('/cerrar-sesion', autenticacionController.cerrarSesion);

module.exports = router;