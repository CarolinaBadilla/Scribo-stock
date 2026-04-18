// src/routes/reportes.js
const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

// GET /api/reportes/ventas
router.get('/ventas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, sucursalId } = req.query;
    
    console.log('📊 Reporte ventas - Filtros:', { fechaInicio, fechaFin, sucursalId });
    
    // Primero obtener los movimientos
    let query = supabase
      .from('movimientos')
      .select('*')
      .eq('tipo_movimiento', 'venta');
    
    if (fechaInicio) {
      query = query.gte('fecha', fechaInicio);
    }
    if (fechaFin) {
      query = query.lte('fecha', fechaFin);
    }
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined') {
      query = query.eq('sucursal_id', parseInt(sucursalId));
    }
    
    const { data: movimientos, error } = await query.order('fecha', { ascending: false });
    
    if (error) throw error;
    
    console.log(`📊 Encontrados ${movimientos?.length || 0} movimientos`);
    
    // Para cada movimiento, obtener el nombre del producto y sucursal
    const ventasFormateadas = [];
    
    for (const venta of (movimientos || [])) {
      // Obtener nombre del producto
      let nombreProducto = 'Producto no encontrado';
      let detalleProducto = '';
      
      if (venta.tipo_producto === 'libro') {
        const { data: libro } = await supabase
          .from('libros')
          .select('titulo, autor')
          .eq('id', venta.producto_id)
          .single();
        
        if (libro) {
          nombreProducto = libro.titulo;
          detalleProducto = libro.autor || 'Sin autor';
        }
      } else if (venta.tipo_producto === 'ropa') {
        const { data: ropa } = await supabase
          .from('ropa')
          .select('nombre, colegio')
          .eq('id', venta.producto_id)
          .single();
        
        if (ropa) {
          nombreProducto = ropa.nombre;
          detalleProducto = ropa.colegio || 'Sin colegio';
        }
      }
      
      // Obtener nombre de sucursal
      let sucursalNombre = 'Sin sucursal';
      if (venta.sucursal_id) {
        const { data: sucursal } = await supabase
          .from('sucursales')
          .select('nombre')
          .eq('id', venta.sucursal_id)
          .single();
        
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      
      // Asegurar que los precios son números
      const precioUnitario = parseFloat(venta.precio_unitario) || 0;
      const cantidad = parseInt(venta.cantidad) || 0;
      
      ventasFormateadas.push({
        id: venta.id,
        fecha: venta.fecha,
        tipo_producto: venta.tipo_producto,
        nombre_producto: nombreProducto,
        detalle_producto: detalleProducto,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        total: cantidad * precioUnitario,
        descuento: venta.descuento_porcentaje || 0,
        sucursal: sucursalNombre
      });
    }
    
    res.json(ventasFormateadas);
  } catch (error) {
    console.error('❌ Error en reporte ventas:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /api/reportes/stock-actual
router.get('/stock-actual', async (req, res) => {
  try {
    const { sucursalId } = req.query;
    
    console.log('📊 Reporte stock - Sucursal:', sucursalId);
    
    let query = supabase
      .from('vista_stock_completo')
      .select('*');
    
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined') {
      query = query.eq('sucursal_id', parseInt(sucursalId));
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Asegurar que los precios son números
    const datosFormateados = (data || []).map(item => ({
      ...item,
      precio_efectivo: parseFloat(item.precio_efectivo) || 0,
      precio_tarjeta: parseFloat(item.precio_tarjeta) || 0,
      cantidad: parseInt(item.cantidad) || 0
    }));
    
    console.log(`📊 Encontrados ${datosFormateados.length} productos`);
    res.json(datosFormateados);
  } catch (error) {
    console.error('❌ Error en reporte stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reportes/compras
router.get('/compras', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, sucursalId } = req.query;
    
    let query = supabase
      .from('movimientos')
      .select('*')
      .eq('tipo_movimiento', 'compra');
    
    if (fechaInicio) {
      query = query.gte('fecha', fechaInicio);
    }
    if (fechaFin) {
      query = query.lte('fecha', fechaFin);
    }
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined') {
      query = query.eq('sucursal_id', parseInt(sucursalId));
    }
    
    const { data: movimientos, error } = await query.order('fecha', { ascending: false });
    
    if (error) throw error;
    
    const comprasFormateadas = [];
    
    for (const compra of (movimientos || [])) {
      let nombreProducto = 'Producto no encontrado';
      
      if (compra.tipo_producto === 'libro') {
        const { data: libro } = await supabase
          .from('libros')
          .select('titulo')
          .eq('id', compra.producto_id)
          .single();
        
        if (libro) nombreProducto = libro.titulo;
      } else if (compra.tipo_producto === 'ropa') {
        const { data: ropa } = await supabase
          .from('ropa')
          .select('nombre')
          .eq('id', compra.producto_id)
          .single();
        
        if (ropa) nombreProducto = ropa.nombre;
      }
      
      let sucursalNombre = 'Sin sucursal';
      if (compra.sucursal_id) {
        const { data: sucursal } = await supabase
          .from('sucursales')
          .select('nombre')
          .eq('id', compra.sucursal_id)
          .single();
        
        if (sucursal) sucursalNombre = sucursal.nombre;
      }
      
      const precioUnitario = parseFloat(compra.precio_unitario) || 0;
      const cantidad = parseInt(compra.cantidad) || 0;
      
      comprasFormateadas.push({
        id: compra.id,
        fecha: compra.fecha,
        tipo_producto: compra.tipo_producto,
        nombre_producto: nombreProducto,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        total: cantidad * precioUnitario,
        sucursal: sucursalNombre
      });
    }
    
    res.json(comprasFormateadas);
  } catch (error) {
    console.error('❌ Error en reporte compras:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reportes/movimientos
router.get('/movimientos', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, sucursalId } = req.query;
    
    console.log('📊 Reporte movimientos - Filtros:', { fechaInicio, fechaFin, sucursalId });
    
    let query = supabase
      .from('movimientos')
      .select('*');
    
    if (fechaInicio && fechaInicio !== 'null' && fechaInicio !== 'undefined') {
      query = query.gte('fecha', fechaInicio);
    }
    if (fechaFin && fechaFin !== 'null' && fechaFin !== 'undefined') {
      query = query.lte('fecha', fechaFin);
    }
    if (sucursalId && sucursalId !== 'null' && sucursalId !== 'undefined') {
      query = query.eq('sucursal_id', parseInt(sucursalId));
    }
    
    const { data: movimientos, error } = await query.order('fecha', { ascending: false });
    
    if (error) throw error;
    
    console.log(`📊 Encontrados ${movimientos?.length || 0} movimientos`);
    
    if (!movimientos || movimientos.length === 0) {
      return res.json([]);
    }
    
    const movimientosFormateados = [];
    
    for (const mov of movimientos) {
      // Obtener nombre del producto
      let nombreProducto = 'Producto no encontrado';
      
      try {
        if (mov.tipo_producto === 'libro') {
          const { data: libro } = await supabase
            .from('libros')
            .select('titulo')
            .eq('id', mov.producto_id)
            .single();
          
          if (libro) nombreProducto = libro.titulo;
        } else if (mov.tipo_producto === 'ropa') {
          const { data: ropa } = await supabase
            .from('ropa')
            .select('nombre')
            .eq('id', mov.producto_id)
            .single();
          
          if (ropa) nombreProducto = ropa.nombre;
        }
      } catch (err) {
        console.error('Error obteniendo producto:', err);
      }
      
      // Obtener nombre de sucursal
      let sucursalNombre = 'Sin sucursal';
      try {
        if (mov.sucursal_id) {
          const { data: sucursal } = await supabase
            .from('sucursales')
            .select('nombre')
            .eq('id', mov.sucursal_id)
            .single();
          
          if (sucursal) sucursalNombre = sucursal.nombre;
        }
      } catch (err) {
        console.error('Error obteniendo sucursal:', err);
      }
      
      const precioUnitario = parseFloat(mov.precio_unitario) || 0;
      const cantidad = parseInt(mov.cantidad) || 0;
      
      movimientosFormateados.push({
        id: mov.id,
        fecha: mov.fecha,
        tipo: mov.tipo_movimiento === 'venta' ? 'Venta' : 'Compra',
        tipo_producto: mov.tipo_producto,
        nombre_producto: nombreProducto,
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        total: cantidad * precioUnitario,
        sucursal: sucursalNombre
      });
    }
    
    res.json(movimientosFormateados);
  } catch (error) {
    console.error('❌ Error en reporte movimientos:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

module.exports = router;