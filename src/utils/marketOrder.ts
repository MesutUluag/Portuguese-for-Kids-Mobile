import type { MarketItem } from '@/core/data/types';

/**
 * Returns the European Portuguese numeral word matching item grammatical gender.
 */
export function getMarketNumberWord(count: number, gender: 'm' | 'f'): string {
  if (count === 1) return gender === 'm' ? 'um' : 'uma';
  if (count === 2) return gender === 'm' ? 'dois' : 'duas';
  if (count === 3) return 'três';
  if (count === 4) return 'quatro';
  return count.toString();
}

/**
 * Builds the displayed & spoken shopping order phrase, e.g.
 * `"um quilo de Maçã!"`, `"dois quilos de Tomate!"`, `"duas bananas!"`.
 */
export function buildMarketOrderText(
  count: number,
  item: Pick<MarketItem, 'ptName' | 'pluralName' | 'gender' | 'unit'>,
): string {
  if (item.unit === 'kg') {
    const kilo = count === 1 ? 'um quilo' : `${getMarketNumberWord(count, 'm')} quilos`;
    return `${kilo} de ${item.ptName}!`;
  }
  const nw = getMarketNumberWord(count, item.gender);
  const nm = count === 1 ? item.ptName : item.pluralName;
  return `${nw} ${nm}!`;
}

/**
 * Builds the spoken count phrase when adding an item to the cart.
 */
export function buildMarketCountSpeech(
  count: number,
  item: Pick<MarketItem, 'gender' | 'unit'>,
): string {
  if (item.unit === 'kg') {
    return count === 1 ? 'um quilo' : `${getMarketNumberWord(count, 'm')} quilos`;
  }
  return getMarketNumberWord(count, item.gender);
}
