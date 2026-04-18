// src/routes/productos.js
const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

// GET /api/productos/buscar?codigo=XXX&sucursal=1
router.get('/buscar', async (req, res) => {
  try {
    const { codigo, sucursal } = req.query;
    
    console.log('🔍 Buscando código:', codigo, 'en sucursal:', sucursal);
    
    // Buscar en libros
    const { data: libro, error: libroError } = await supabase
      .from('libros')
      .select('*')
      .eq('codigo_barras', codigo)
      .single();
    
    if (libro && !libroError) {
      console.log('📚 Libro encontrado:', libro.titulo);
      
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('cantidad, stock_minimo')
        .eq('tipo_producto', 'libro')
        .eq('producto_id', libro.id)
        .eq('sucursal_id', sucursal)
        .single();
      
      const responseData = {
        tipo_producto: 'libro',
        producto_id: libro.id,
        nombre_producto: libro.titulo,
        precio_efectivo: libro.precio_efectivo || 0,
        precio_tarjeta: libro.precio_tarjeta || libro.precio_efectivo || 0,
        cantidad: stock?.cantidad || 0,
        stock_minimo: stock?.stock_minimo || 5,
        autor: libro.autor,
        editorial: libro.editorial
      };
      
      console.log('📤 Respuesta:', responseData);
      return res.json(responseData);
    }
    
    // Buscar en ropa
    const { data: ropa, error: ropaError } = await supabase
      .from('ropa')
      .select('*')
      .eq('codigo_barras', codigo)
      .single();
    
    if (ropa && !ropaError) {
      console.log('👕 Ropa encontrada:', ropa.nombre);
      
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('cantidad, stock_minimo')
        .eq('tipo_producto', 'ropa')
        .eq('producto_id', ropa.id)
        .eq('sucursal_id', sucursal)
        .single();
      
      const responseData = {
        tipo_producto: 'ropa',
        producto_id: ropa.id,
        nombre_producto: ropa.nombre,
        precio_efectivo: ropa.precio_efectivo || 0,
        precio_tarjeta: ropa.precio_tarjeta || ropa.precio_efectivo || 0,
        cantidad: stock?.cantidad || 0,
        stock_minimo: stock?.stock_minimo || 5,
        colegio: ropa.colegio,
        talle: ropa.talle,
        color: ropa.color,
        precio_compra: ropa.precio_compra
      };
      
      console.log('📤 Respuesta:', responseData);
      return res.json(responseData);
    }
    
    console.log('❌ Producto no encontrado con código:', codigo);
    res.status(404).json({ error: 'Producto no encontrado' });
  } catch (error) {
    console.error('❌ Error en búsqueda:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;