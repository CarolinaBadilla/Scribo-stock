// backend/src/schemas/ventasSchema.js
const { z } = require('zod');

const registrarVentaSchema = z.object({
  sucursalId: z.coerce.number().int().positive('La sucursal debe ser un ID válido'),
  tipoPago: z.enum(['efectivo', 'tarjeta', 'mercadopago', 'qr', 'posnet'], {
    errorMap: () => ({ message: 'El medio de pago debe ser "efectivo", "tarjeta" o "mercadopago"' })
  }),
  ventaId: z.string().trim().max(100).optional(),
  emitir_factura: z.coerce.boolean().optional().default(false),
  cliente_doc_tipo: z.coerce.number().int().optional().default(99),
  cliente_doc_nro: z.string().trim().optional().default('0'),
  items: z.array(
    z.object({
      tipoProducto: z.string().trim().optional(),
      categoria: z.string().trim().optional(),
      productoId: z.coerce.number().int().positive().nullable().optional(),
      producto_unificado_id: z.coerce.number().int().positive().nullable().optional(),
      id: z.coerce.number().int().positive().nullable().optional(),
      nombre: z.string().trim().optional(),
      descripcion: z.string().trim().optional(),
      precio_unitario: z.coerce.number().min(0).optional(),
      precioUnitario: z.coerce.number().min(0).optional(),
      es_temporal: z.coerce.boolean().optional(),
      // Soporte para balanza: cantidades decimales NUMERIC(10,3) como 0.250 kg
      cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
      descuento: z.coerce.number().min(0).max(100).default(0)
    })
  ).min(1, 'El carrito debe tener al menos un producto')
});

module.exports = { registrarVentaSchema };
