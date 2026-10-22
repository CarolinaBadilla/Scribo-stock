// backend/src/schemas/ventasSchema.js
const { z } = require('zod');

const registrarVentaSchema = z.object({
  sucursalId: z.coerce.number().int().positive('La sucursal debe ser un ID válido'),
  tipoPago: z.enum(['efectivo', 'tarjeta'], {
    errorMap: () => ({ message: 'El medio de pago debe ser "efectivo" o "tarjeta"' })
  }),
  items: z.array(
    z.object({
      tipoProducto: z.enum(['libro', 'ropa'], {
        errorMap: () => ({ message: 'El tipo debe ser "libro" o "ropa"' })
      }),
      productoId: z.coerce.number().int().positive('ID de producto inválido'),
      cantidad: z.coerce.number().int().min(1, 'La cantidad mínima es 1'),
      descuento: z.coerce.number().min(0).max(100).default(0)
    })
  ).min(1, 'El carrito debe tener al menos un producto')
});

module.exports = { registrarVentaSchema };