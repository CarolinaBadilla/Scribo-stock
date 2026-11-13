// src/utils/formatters.js
export const formatMoney = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$ 0';
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    return '-';
  }
};

/**
 * Formatea atributos dinámicos (JSONB) o detalle de producto de manera legible según categoría:
 * - Libro: Autor entre comillas y editorial ("Borges" - Sudamericana)
 * - Ropa: Talle y color (Talle: M / Color: Azul)
 * - Otros rubros: Valores no vacíos de atributos (ej: "Marca: La Paulina · Origen: Córdoba")
 * - Sanitiza y parsea strings JSON crudos si vienen en producto.detalle
 */
export const formatearAtributos = (producto) => {
  if (!producto) return '-';

  let attrs = producto.atributos;
  if (typeof attrs === 'string') {
    try {
      attrs = JSON.parse(attrs);
    } catch {
      attrs = null;
    }
  }

  const categoria = (producto.categoria || producto.tipo_producto || '').toLowerCase();

  // 1. Libros
  if (categoria === 'libro') {
    const autor = attrs?.autor || producto.autor;
    const editorial = attrs?.editorial || producto.editorial;
    if (autor && editorial) return `"${autor}" - ${editorial}`;
    if (autor) return `"${autor}"`;
    if (editorial) return `${editorial}`;
  }

  // 2. Ropa
  if (categoria === 'ropa') {
    const talle = attrs?.talle || producto.talle;
    const color = attrs?.color || producto.color;
    const colegio = attrs?.colegio || producto.colegio;
    const partes = [];
    if (talle) partes.push(`Talle: ${talle}`);
    if (color) partes.push(`Color: ${color}`);
    if (colegio) partes.push(colegio);
    if (partes.length > 0) return partes.join(' / ');
  }

  // 3. Otros rubros (mostrar valores no vacíos de atributos)
  if (attrs && typeof attrs === 'object' && Object.keys(attrs).length > 0) {
    const entradas = Object.entries(attrs)
      .filter(([_, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '')
      .map(([clave, valor]) => {
        const label = clave.charAt(0).toUpperCase() + clave.slice(1).replace(/_/g, ' ');
        return `${label}: ${valor}`;
      });
    if (entradas.length > 0) return entradas.join(' · ');
  }

  // 4. Detalle con fallback (evitando imprimir JSON crudo si viene como string)
  if (producto.detalle && typeof producto.detalle === 'string') {
    const trimmed = producto.detalle.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const entries = Object.entries(parsed)
          .filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== '')
          .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')}: ${v}`);
        if (entries.length > 0) return entries.join(' · ');
      } catch {
        // Fallback a texto plano si no era JSON
      }
    }
    return producto.detalle;
  }

  return '-';
};

/**
 * Formatea la cantidad de stock:
 * - Si es pesable: 3 decimales y unidad (ej: "0.350 kg")
 * - Si no es pesable: número entero sin decimales innecesarios (ej: "7 und")
 */
export const formatearCantidadStock = (cantidad, esPesable = false, unidadMedida = 'kg') => {
  const num = Number(cantidad) || 0;
  if (esPesable) {
    const unidad = (!unidadMedida || unidadMedida === 'unidad') ? 'kg' : unidadMedida;
    return `${num.toFixed(3)} ${unidad}`;
  }
  return `${Math.round(num * 1000) / 1000} und`;
};
