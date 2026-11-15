import {
  buildMarketCountSpeech,
  buildMarketOrderText,
  getMarketNumberWord,
} from '@/utils/marketOrder';

describe('marketOrder helpers', () => {
  it('uses gendered Portuguese numerals for 1 and 2', () => {
    expect(getMarketNumberWord(1, 'm')).toBe('um');
    expect(getMarketNumberWord(1, 'f')).toBe('uma');
    expect(getMarketNumberWord(2, 'm')).toBe('dois');
    expect(getMarketNumberWord(2, 'f')).toBe('duas');
    expect(getMarketNumberWord(3, 'f')).toBe('três');
    expect(getMarketNumberWord(4, 'm')).toBe('quatro');
  });

  it('formats kg and piece orders matching web Game7', () => {
    expect(
      buildMarketOrderText(1, {
        ptName: 'Maçã',
        pluralName: 'maçãs',
        gender: 'f',
        unit: 'kg',
      }),
    ).toBe('um quilo de Maçã!');

    expect(
      buildMarketOrderText(2, {
        ptName: 'Tomate',
        pluralName: 'tomates',
        gender: 'm',
        unit: 'kg',
      }),
    ).toBe('dois quilos de Tomate!');

    expect(
      buildMarketOrderText(2, {
        ptName: 'Bolacha',
        pluralName: 'bolachas',
        gender: 'f',
      }),
    ).toBe('duas bolachas!');

    expect(
      buildMarketOrderText(1, {
        ptName: 'Pão',
        pluralName: 'pães',
        gender: 'm',
      }),
    ).toBe('um Pão!');
  });

  it('builds spoken count text for kg and piece taps', () => {
    expect(buildMarketCountSpeech(1, { gender: 'f', unit: 'kg' })).toBe('um quilo');
    expect(buildMarketCountSpeech(3, { gender: 'f', unit: 'kg' })).toBe('três quilos');
    expect(buildMarketCountSpeech(2, { gender: 'f' })).toBe('duas');
    expect(buildMarketCountSpeech(2, { gender: 'm' })).toBe('dois');
  });
});
