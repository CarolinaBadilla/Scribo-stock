// src/utils/filters.test.js
import { describe, it, expect } from 'vitest';

const filtrarProductos = (productos, busqueda, filtroTipo) => {
  let resultado = productos;
  
  if (filtroTipo !== 'todos') {
    resultado = resultado.filter(p => p.tipo_producto === filtroTipo);
  }
  
  if (busqueda) {
    resultado = resultado.filter(p =>
      p.nombre_producto?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.detalle?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }
  
  return resultado;
};

describe('filtrarProductos', () => {
  const productos = [
    { nombre_producto: 'Cien años de soledad', tipo_producto: 'libro', detalle: 'García Márquez' },
    { nombre_producto: 'Chomba', tipo_producto: 'ropa', detalle: 'Colegio San Luis' },
    { nombre_producto: 'El principito', tipo_producto: 'libro', detalle: 'Saint-Exupéry' }
  ];

  it('debe devolver todos los productos sin filtros', () => {
    expect(filtrarProductos(productos, '', 'todos').length).toBe(3);
  });

  it('debe filtrar por tipo libro', () => {
    const resultado = filtrarProductos(productos, '', 'libro');
    expect(resultado.length).toBe(2);
    expect(resultado.every(p => p.tipo_producto === 'libro')).toBe(true);
  });

  it('debe filtrar por búsqueda de texto', () => {
    const resultado = filtrarProductos(productos, 'chomba', 'todos');
    expect(resultado.length).toBe(1);
    expect(resultado[0].nombre_producto).toBe('Chomba');
  });

  it('debe combinar filtros', () => {
    const resultado = filtrarProductos(productos, 'años', 'libro');
    expect(resultado.length).toBe(1);
    expect(resultado[0].nombre_producto).toBe('Cien años de soledad');
  });
});