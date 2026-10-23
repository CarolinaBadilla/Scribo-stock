const { z } = require('zod');

const registrarCompraSchema = z.object({
  sucursalId: z.coerce.number().int().positive(),
  items: z.array(z.object({
    tipoProducto: z.enum(['libro', 'ropa']),
    productoId: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().min(1).max(100000),
    precioCompra: z.coerce.number().min(0).max(100000000)
  })).min(1).max(200)
});

module.exports = { registrarCompraSchema };