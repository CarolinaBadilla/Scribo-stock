// src/routes/stock.js
const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

router.get('/por-sucursal/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('vista_stock_completo')
      .select('*')
      .eq('sucursal_id', id);
    
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/agregar', async (req, res) => {
  try {
    const { tipoProducto, productoId, cantidad, sucursalId } = req.body;
    
    const { data: existingStock, error: findError } = await supabase
      .from('stock')
      .select('*')
      .eq('tipo_producto', tipoProducto)
      .eq('producto_id', productoId)
      .eq('sucursal_id', sucursalId)
      .single();
    
    if (findError && findError.code !== 'PGRST116') throw findError;
    
    let result;
    if (existingStock) {
      const { data, error } = await supabase
        .from('stock')
        .update({ 
          cantidad: existingStock.cantidad + cantidad,
          updated_at: new Date()
        })
        .eq('id', existingStock.id)
        .select();
      
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('stock')
        .insert({
          tipo_producto: tipoProducto,
          producto_id: productoId,
          sucursal_id: sucursalId,
          cantidad: cantidad
        })
        .select();
      
      if (error) throw error;
      result = data;
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;