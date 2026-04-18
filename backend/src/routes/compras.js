// src/routes/compras.js
const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

router.post('/registrar', async (req, res) => {
  try {
    const { sucursalId, items, usuarioId } = req.body;
    
    const movimientos = [];
    
    for (const item of items) {
      const { data: movimiento, error: movError } = await supabase
        .from('movimientos')
        .insert({
          tipo_producto: item.tipoProducto,
          producto_id: item.productoId,
          sucursal_id: sucursalId,
          tipo_movimiento: 'compra',
          cantidad: item.cantidad,
          precio_unitario: item.precioCompra,
          usuario_id: usuarioId
        })
        .select();
      
      if (movError) throw movError;
      movimientos.push(movimiento);
    }
    
    res.json({ 
      success: true, 
      message: 'Compra registrada correctamente',
      movimientos 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;