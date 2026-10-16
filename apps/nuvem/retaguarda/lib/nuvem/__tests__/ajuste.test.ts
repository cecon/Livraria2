import { expect, test } from 'vitest';
import { lerQtdAjuste } from '../ajuste';

test('ajuste aceita so inteiro exato com sinal', () => {
  expect(lerQtdAjuste('-2')).toBe(-2);
  expect(lerQtdAjuste(' +3 ')).toBe(3);
  expect(lerQtdAjuste('4')).toBe(4);
});

test('ajuste recusa zero, vazio, decimal e lixo', () => {
  for (const texto of ['0', '-0', '', '  ', '2,5', '2.5', '-2abc', 'abc', '9007199254740993']) {
    expect(lerQtdAjuste(texto)).toBeNull();
  }
});
