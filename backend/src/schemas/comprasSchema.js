const { z } = require('zod');

const registrarCompraSchema = z.object({
  sucursalId: z.coerce.number().int().positive('La sucursal debe ser un ID válido'),
  items: z.array(z.object({
    tipoProducto: z.string().trim().optional(),
    productoId: z.coerce.number().int().positive().optional(),
    producto_unificado_id: z.coerce.number().int().positive().optional(),
    cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0').max(100000),
    precioCompra: z.coerce.number().min(0).max(100000000)
  })).min(1).max(200)
});

module.exports = { registrarCompraSchema };
