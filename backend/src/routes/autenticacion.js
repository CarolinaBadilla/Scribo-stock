const express = require('express');
const router = express.Router();
const autenticacionController = require('../controllers/autenticacionController');
const { validar } = require('../middleware/validar');
const { loginSchema } = require('../schemas/authSchema');

router.post('/iniciar-sesion', validar(loginSchema), autenticacionController.iniciarSesion);
router.get('/perfil', autenticacionController.obtenerPerfil);
router.post('/cerrar-sesion', autenticacionController.cerrarSesion);

module.exports = router;