// backend/src/schemas/productosSchema.js
const { z } = require('zod');

const crearProductoSchema = z.object({
  tipo: z.enum(['libro', 'ropa']),
  codigo_barras: z.string().trim().min(3, 'El código de barras es requerido'),
  nombre: z.string().trim().min(1, 'El nombre o título es requerido'),
  precio_compra: z.coerce.number().min(0).default(0),
  precio_efectivo: z.coerce.number().positive('El precio en efectivo debe ser mayor a 0'),
  precio_tarjeta: z.coerce.number().min(0).optional(),
  sucursal_id: z.coerce.number().int().positive().optional(),
  cantidad_inicial: z.coerce.number().int().min(0).default(0),
  
  // Atributos dinámicos
  autor: z.string().trim().nullable().optional(),
  editorial: z.string().trim().nullable().optional(),
  colegio: z.string().trim().nullable().optional(),
  talle: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional()
});

module.exports = { crearProductoSchema };