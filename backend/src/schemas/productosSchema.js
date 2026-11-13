// backend/src/schemas/productosSchema.js
const { z } = require('zod');

const crearProductoSchema = z.object({
  categoria: z.string().trim().optional(),
  tipo: z.string().trim().optional(), // Compatibilidad legacy ('libro', 'ropa')
  nombre: z.string().trim().min(1, 'El nombre o título del producto es requerido'),
  codigo_barras: z.string().trim().nullable().optional(),
  es_pesable: z.coerce.boolean().optional().default(false),
  codigo_plu: z.string().trim().max(10).nullable().optional(),
  unidad_medida: z.enum(['unidad', 'kg', 'g']).optional().default('unidad'),
  precio_compra: z.coerce.number().min(0).default(0),
  precio_efectivo: z.coerce.number().min(0, 'El precio en efectivo debe ser mayor o igual a 0'),
  precio_tarjeta: z.coerce.number().min(0).optional(),
  atributos: z.record(z.any()).optional().default({}),
  sucursal_id: z.coerce.number().int().positive().optional(),
  cantidad_inicial: z.coerce.number().min(0).default(0),

  // Atributos dinámicos por rubro / legacy
  autor: z.string().trim().nullable().optional(),
  editorial: z.string().trim().nullable().optional(),
  colegio: z.string().trim().nullable().optional(),
  talle: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  marca: z.string().trim().nullable().optional(),
  fecha_vencimiento: z.string().trim().nullable().optional(),
  descripcion_extra: z.string().trim().nullable().optional()
});

const actualizarPreciosMasivoSchema = z.object({
  categoria: z.string().trim().default('todas'),
  porcentaje: z.coerce.number().min(-90, 'El porcentaje no puede ser menor a -90%').max(1000, 'El porcentaje no puede superar el 1000%'),
  redondeo: z.coerce.number().refine(val => [1, 10, 50, 100].includes(val), {
    message: 'El redondeo debe ser 1, 10, 50 o 100'
  }).default(1)
});

const itemPrecioLoteSchema = z.object({
  id: z.coerce.number().int().positive('ID de producto inválido'),
  precio_efectivo: z.coerce.number().min(0, 'El precio efectivo no puede ser negativo'),
  precio_tarjeta: z.coerce.number().min(0, 'El precio tarjeta no puede ser negativo')
});

const actualizarPreciosLoteSchema = z.union([
  z.object({
    productos: z.array(itemPrecioLoteSchema).min(1, 'Debe enviar al menos un producto para actualizar')
  }),
  z.array(itemPrecioLoteSchema).min(1, 'Debe enviar al menos un producto para actualizar')
]);

module.exports = { 
  crearProductoSchema, 
  actualizarPreciosMasivoSchema,
  actualizarPreciosLoteSchema
};
