export type JigsawEdges = readonly [number, number, number, number];

/**
 * Mathematically verified 3x3 jigsaw edge table from web Game6.tsx.
 * Edge tuple order: [top, right, bottom, left] where 1 = tab, -1 = blank, 0 = flat.
 */
export const EDGE_TABLE: readonly JigsawEdges[] = [
  [0, 1, 1, 0],
  [0, 1, 1, -1],
  [0, 0, 1, -1],
  [-1, 1, -1, 0],
  [-1, 1, -1, -1],
  [-1, 0, -1, -1],
  [1, 1, 0, 0],
  [1, 1, 0, -1],
  [1, 0, 0, -1],
] as const;

export function verifyEdgeComplementarity(
  table: readonly JigsawEdges[] = EDGE_TABLE,
  cols = 3,
  rows = 3,
): boolean {
  if (table.length !== cols * rows) {
    return false;
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const piece = table[row * cols + col];
      if (!piece) {
        return false;
      }
      if (col < cols - 1) {
        const rightNeighbor = table[row * cols + col + 1];
        if (!rightNeighbor || piece[1] + rightNeighbor[3] !== 0) {
          return false;
        }
      }
      if (row < rows - 1) {
        const bottomNeighbor = table[(row + 1) * cols + col];
        if (!bottomNeighbor || piece[2] + bottomNeighbor[0] !== 0) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Builds an SVG path string matching web Game6.tsx `drawJigsawPath` arc directions
 * so adjacent snapped puzzle pieces interlock cleanly.
 */
export function buildJigsawSvgPath(
  edges: JigsawEdges,
  x: number,
  y: number,
  pw: number,
  ph: number,
  r: number,
): string {
  const [eTop, eRight, eBottom, eLeft] = edges;
  const parts: string[] = [`M ${x} ${y}`];

  if (eTop === 0) {
    parts.push(`L ${x + pw} ${y}`);
  } else {
    parts.push(`L ${x + pw / 2 - r} ${y}`);
    parts.push(`A ${r} ${r} 0 0 ${eTop === 1 ? 0 : 1} ${x + pw / 2 + r} ${y}`);
    parts.push(`L ${x + pw} ${y}`);
  }

  if (eRight === 0) {
    parts.push(`L ${x + pw} ${y + ph}`);
  } else {
    parts.push(`L ${x + pw} ${y + ph / 2 - r}`);
    parts.push(`A ${r} ${r} 0 0 ${eRight === -1 ? 0 : 1} ${x + pw} ${y + ph / 2 + r}`);
    parts.push(`L ${x + pw} ${y + ph}`);
  }

  if (eBottom === 0) {
    parts.push(`L ${x} ${y + ph}`);
  } else {
    parts.push(`L ${x + pw / 2 + r} ${y + ph}`);
    parts.push(`A ${r} ${r} 0 0 ${eBottom === 1 ? 0 : 1} ${x + pw / 2 - r} ${y + ph}`);
    parts.push(`L ${x} ${y + ph}`);
  }

  if (eLeft === 0) {
    parts.push(`L ${x} ${y}`);
  } else {
    parts.push(`L ${x} ${y + ph / 2 + r}`);
    parts.push(`A ${r} ${r} 0 0 ${eLeft === -1 ? 0 : 1} ${x} ${y + ph / 2 - r}`);
    parts.push(`L ${x} ${y}`);
  }

  parts.push('Z');
  return parts.join(' ');
}
