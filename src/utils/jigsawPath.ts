import { Skia, type SkPath } from '@shopify/react-native-skia';
import {
  buildJigsawSvgPath,
  EDGE_TABLE,
  verifyEdgeComplementarity,
  type JigsawEdges,
} from '@/utils/jigsawGeometry';

export { EDGE_TABLE, buildJigsawSvgPath, verifyEdgeComplementarity, type JigsawEdges };

export function createJigsawSkiaPath(
  edges: JigsawEdges,
  x: number,
  y: number,
  pw: number,
  ph: number,
  r: number,
): SkPath {
  const svg = buildJigsawSvgPath(edges, x, y, pw, ph, r);
  const path = Skia.Path.MakeFromSVGString(svg);
  if (!path) {
    throw new Error(`Invalid jigsaw SVG path: ${svg}`);
  }
  return path;
}
