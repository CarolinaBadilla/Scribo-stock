// src/components/AlertasStock.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { toast } from 'sonner';

export function AlertasStock() {
  const [alertasMostradas, setAlertasMostradas] = useState(new Set());

  useEffect(() => {
    verificarStockBajo();
    // Verificar cada 5 minutos (300000 milisegundos)
    const intervalo = setInterval(verificarStockBajo, 300000);
    return () => clearInterval(intervalo);
  }, []);

  const verificarStockBajo = async () => {
    try {
      const { data: stock } = await supabase
        .from('vista_stock_completo')
        .select('*')
        .lte('cantidad', 5);

      const productosBajo = (stock || []).filter(p => p.cantidad <= p.stock_minimo);
      
      // Mostrar notificaciones
      productosBajo.forEach(producto => {
        const clave = `${producto.producto_id}-${producto.sucursal_id}`;
        
        if (!alertasMostradas.has(clave)) {
          setAlertasMostradas(prev => new Set([...prev, clave]));
          
          if (producto.cantidad === 0) {
            toast.error(`⚠️ ${producto.nombre_producto} - SIN STOCK en ${producto.sucursal_nombre}!`);
          } else if (producto.cantidad <= 2) {
            toast.warning(`⚠️ ${producto.nombre_producto} - Stock crítico: ${producto.cantidad} unidades en ${producto.sucursal_nombre}`);
          } else {
            toast.info(`📦 ${producto.nombre_producto} - Stock bajo: ${producto.cantidad} unidades en ${producto.sucursal_nombre}`);
          }
        }
      });
    } catch (error) {
      console.error('Error verificando stock:', error);
    }
  };

  // Este componente no muestra nada en pantalla, solo notificaciones
  return null;
}