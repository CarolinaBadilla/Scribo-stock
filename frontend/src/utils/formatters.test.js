// src/utils/formatters.test.js
import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatearAtributos, formatearCantidadStock } from './formatters';

describe('formatMoney', () => {
  it('debe formatear números correctamente', () => {
    expect(typeof formatMoney(1000)).toBe('string');
    expect(typeof formatMoney(1234567)).toBe('string');
    expect(typeof formatMoney(0)).toBe('string');
  });

  it('debe contener el símbolo $', () => {
    expect(formatMoney(1000)).toContain('$');
    expect(formatMoney(1234567)).toContain('$');
    expect(formatMoney(0)).toContain('$');
  });

  it('debe contener los números (con o sin puntos)', () => {
    // Aceptar "1000" o "1.000"
    expect(formatMoney(1000)).toMatch(/1\.?000/);
    // Aceptar "1234567" o "1.234.567"
    expect(formatMoney(1234567)).toMatch(/1\.?234\.?567/);
    expect(formatMoney(0)).toContain('0');
  });

  it('debe manejar valores nulos como $ 0', () => {
    expect(formatMoney(null)).toContain('$');
    expect(formatMoney(null)).toContain('0');
    expect(formatMoney(undefined)).toContain('$');
    expect(formatMoney(undefined)).toContain('0');
    expect(formatMoney(NaN)).toContain('$');
    expect(formatMoney(NaN)).toContain('0');
  });
});

describe('formatDate', () => {
  it('debe formatear fecha correctamente', () => {
    const resultado = formatDate('2024-01-15T10:30:00');
    expect(typeof resultado).toBe('string');
    expect(resultado.length).toBeGreaterThan(5);
    expect(resultado).not.toBe('-');
  });

  it('debe devolver "-" para fecha nula', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('')).toBe('-');
  });
});

describe('formatearAtributos', () => {
  it('debe formatear libro con autor y editorial legible', () => {
    const prod = {
      categoria: 'libro',
      atributos: { autor: 'Jorge Luis Borges', editorial: 'Sudamericana' }
    };
    expect(formatearAtributos(prod)).toBe('"Jorge Luis Borges" - Sudamericana');
  });

  it('debe formatear ropa con talle y color legible', () => {
    const prod = {
      categoria: 'ropa',
      atributos: { talle: 'M', color: 'Azul Marino' }
    };
    expect(formatearAtributos(prod)).toBe('Talle: M / Color: Azul Marino');
  });

  it('debe formatear atributos genéricos para otros rubros', () => {
    const prod = {
      categoria: 'fiambreria',
      atributos: { marca: 'La Paulina', origen: 'Córdoba' }
    };
    expect(formatearAtributos(prod)).toBe('Marca: La Paulina · Origen: Córdoba');
  });

  it('debe sanitizar strings JSON crudos en detalle sin mostrar llaves crudas', () => {
    const prod = {
      categoria: 'general',
      detalle: '{"marca": "Scribo", "tipo": "Cuaderno"}'
    };
    expect(formatearAtributos(prod)).toBe('Marca: Scribo · Tipo: Cuaderno');
  });

  it('debe devolver "-" si no hay atributos ni detalle', () => {
    expect(formatearAtributos({})).toBe('-');
    expect(formatearAtributos(null)).toBe('-');
  });
});

describe('formatearCantidadStock', () => {
  it('debe formatear productos pesables con 3 decimales y unidad', () => {
    expect(formatearCantidadStock(0.35, true, 'kg')).toBe('0.350 kg');
    expect(formatearCantidadStock(1.2, true, 'kg')).toBe('1.200 kg');
    expect(formatearCantidadStock('0.450', true, 'kg')).toBe('0.450 kg');
  });

  it('debe formatear productos no pesables como enteros sin decimales innecesarios', () => {
    expect(formatearCantidadStock(7, false)).toBe('7 und');
    expect(formatearCantidadStock('15.000', false)).toBe('15 und');
    expect(formatearCantidadStock(0, false)).toBe('0 und');
  });
});
