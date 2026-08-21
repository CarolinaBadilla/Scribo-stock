const express = require('express');
const router = express.Router();
const autenticacionController = require('../controllers/autenticacionController');

router.post('/iniciar-sesion', autenticacionController.iniciarSesion);
router.get('/perfil', autenticacionController.obtenerPerfil);
router.post('/cerrar-sesion', autenticacionController.cerrarSesion);

module.exports = router;