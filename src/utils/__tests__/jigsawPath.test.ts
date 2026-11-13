import {
  EDGE_TABLE,
  buildJigsawSvgPath,
  verifyEdgeComplementarity,
} from '@/utils/jigsawGeometry';

describe('jigsawGeometry', () => {
  it('ensures every shared neighbor edge sums to zero', () => {
    expect(verifyEdgeComplementarity(EDGE_TABLE, 3, 3)).toBe(true);
  });

  it('builds a closed SVG path string for flat and tabbed edges', () => {
    const svg = buildJigsawSvgPath([0, 1, -1, 0], 0, 0, 82, 82, 11);
    expect(svg.startsWith('M 0 0')).toBe(true);
    expect(svg.endsWith('Z')).toBe(true);
    expect(svg).toContain('A 11 11 0 0');
  });
});
