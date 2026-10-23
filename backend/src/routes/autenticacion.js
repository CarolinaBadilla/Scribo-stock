const express = require('express');
const rateLimit = require('express-rate-limit');
const autenticacionController = require('../controllers/autenticacionController');
const { validar } = require('../middleware/validar');
const { loginSchema } = require('../schemas/authSchema');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,                  // Máximo 5 intentos fallidos
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Intente nuevamente en 15 minutos.' }
});

router.post('/iniciar-sesion', loginLimiter, validar(loginSchema), autenticacionController.iniciarSesion);
module.exports = router;