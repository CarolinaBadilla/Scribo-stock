// backend/src/schemas/authSchema.js
const { z } = require('zod');

const loginSchema = z.object({
  usuario: z.string().trim().optional(),
  email: z.string().trim().optional(),
  clave: z.string().min(1, 'La contraseña es obligatoria')
}).refine(data => data.usuario || data.email, {
  message: 'Debes proporcionar un nombre de usuario o un correo electrónico',
  path: ['identificador']
});

module.exports = { loginSchema };