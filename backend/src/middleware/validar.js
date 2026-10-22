// backend/src/middleware/validar.js

/**
 * Validador genérico para esquemas de Zod
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} origen - Por defecto valida req.body
 */
const validar = (schema, origen = 'body') => (req, res, next) => {
  const resultado = schema.safeParse(req[origen]);

  if (!resultado.success) {
    // Retornamos un formato limpio de errores por campo
    const erroresFormateados = resultado.error.flatten().fieldErrors;
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      detalles: erroresFormateados
    });
  }

  // 🔒 Reemplazamos los datos crudos por los datos limpios y tipados de Zod
  // (descarta campos extra no definidos en el esquema)
  req[origen] = resultado.data;
  next();
};

module.exports = { validar };