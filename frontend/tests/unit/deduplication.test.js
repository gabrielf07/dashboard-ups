import { describe, it, expect } from 'vitest';
import { levenshteinDistance, extractSerial, normalizeString } from '../../execute_advanced_deduplication.js';

describe('Advanced Deduplication Utils', () => {
  describe('levenshteinDistance', () => {
    it('debería calcular la distancia correcta entre strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('gato', 'gato')).toBe(0);
      expect(levenshteinDistance('gato', 'pato')).toBe(1);
      expect(levenshteinDistance('gato', 'gatos')).toBe(1);
      expect(levenshteinDistance('oso', 'perro')).toBe(4);
    });
  });

  describe('extractSerial', () => {
    it('debería extraer un serial válido', () => {
      expect(extractSerial('UPS SERIAL: 12345ABCD')).toBe('12345ABCD');
      expect(extractSerial('ups serial:12345abcd')).toBe('12345ABCD');
      expect(extractSerial('UPS CON SERIAL 9999XYZ')).toBe('9999XYZ'); // El regex hace opcional el ':'
    });

    it('debería ignorar seriales inválidos o nulos', () => {
      expect(extractSerial('SERIAL: S/N')).toBeNull();
      expect(extractSerial('SERIAL: N/A')).toBeNull();
      expect(extractSerial('SERIAL: 12')).toBeNull(); // muy corto
    });
  });

  describe('normalizeString', () => {
    it('debería limpiar y normalizar cadenas de equipos', () => {
      expect(normalizeString('UPS MARCA X DE 3 KVA')).toBe('MARCA X 3');
      expect(normalizeString('  ups   modelo y   ')).toBe('MODELO Y');
      expect(normalizeString('UPS SERIAL: 123')).toBe('SERIAL:123'); // Quita espacios después de SERIAL:
    });

    it('debería manejar strings vacíos', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
      expect(normalizeString('')).toBe('');
    });
  });
});
