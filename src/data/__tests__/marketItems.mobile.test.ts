import {
  MOBILE_EXCLUDED_MARKET_ITEMS,
  marketItems,
} from '@/data/marketItems.mobile';

describe('marketItems.mobile', () => {
  it('excludes alcohol items from the child mobile build', () => {
    const ids = new Set(marketItems.map((item) => item.id));
    for (const excludedId of MOBILE_EXCLUDED_MARKET_ITEMS) {
      expect(ids.has(excludedId)).toBe(false);
    }
  });

  it('maps traditional Portuguese specialty items to pre-rasterized PNG assets', () => {
    for (const specialtyId of ['pastel_nata', 'bacalhau', 'chourico', 'jam']) {
      const item = marketItems.find((entry) => entry.id === specialtyId);
      expect(item).toBeDefined();
      expect(item?.iconAsset).toBeDefined();
    }
  });
});
