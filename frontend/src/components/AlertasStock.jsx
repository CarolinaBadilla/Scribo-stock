// src/components/AlertasStock.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'sonner';
import { formatearCantidadStock } from '../utils/formatters';

export function AlertasStock() {
  const [alertasMostradas, setAlertasMostradas] = useState(new Set());

  useEffect(() => {
    verificarStockBajo();
    
    // Consultar el estado del stock crítico cada 5 minutos
    const intervalo = setInterval(verificarStockBajo, 300000);
    return () => clearInterval(intervalo);
  }, []);

  const verificarStockBajo = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Petición al endpoint del backend Node.js
      const response = await api.get('/stock/alertas');
      const productosBajo = response.data || [];

      setAlertasMostradas((prevAlertas) => {
        const nuevasAlertas = new Set(prevAlertas);

        productosBajo.forEach((producto) => {
          const clave = `${producto.producto_id || producto.id}-${producto.sucursal_id}`;

          // Emitir notificación si no fue notificado previamente en esta sesión
          if (!nuevasAlertas.has(clave)) {
            nuevasAlertas.add(clave);

            const nombre = producto.nombre_producto || 'Producto';
            const sucursal = producto.sucursal_nombre || 'Sucursal';
            const cantidad = Number(producto.cantidad) || 0;
            const cantFormateada = formatearCantidadStock(cantidad, producto.es_pesable, producto.unidad_medida);

            if (cantidad === 0) {
              toast.error(`⚠️ ${nombre} - ¡SIN STOCK en ${sucursal}!`, {
                duration: 6000,
              });
            } else if (cantidad <= 2) {
              toast.warning(`⚠️ ${nombre} - Stock crítico: ${cantFormateada} en ${sucursal}`, {
                duration: 5000,
              });
            } else {
              toast.info(`📦 ${nombre} - Stock bajo: ${cantFormateada} en ${sucursal}`, {
                duration: 4000,
              });
            }
          }
        });

        return nuevasAlertas;
      });
    } catch (error) {
      console.error('Error al verificar alertas de stock:', error);
    }
  };

  // Componente de servicio en segundo plano (renderiza de forma transparente)
  return null;
}