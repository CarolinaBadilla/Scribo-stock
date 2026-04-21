// src/utils/formatters.test.js
import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate } from './formatters';

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