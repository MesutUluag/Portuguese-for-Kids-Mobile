import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Canvas,
  Group,
  Path,
  Rect,
  RoundedRect,
  useImage,
  Image as SkiaImage,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, radii, spacing, touchTargets } from '@/theme/tokens';
import { EDGE_TABLE, createJigsawSkiaPath } from '@/utils/jigsawPath';

const COLS = 3;
const ROWS = 3;
const TOTAL_PIECES = COLS * ROWS;
const BASE_PIECE = 82;
const BASE_TRAY = 68;
const BASE_GAP = 14;
const BASE_PAD = 14;
const BASE_BOARD_X = BASE_PAD + BASE_TRAY + BASE_GAP;
const BASE_BOARD_Y = 10;
const BASE_BOARD_W = COLS * BASE_PIECE;
const BASE_CANVAS_W = BASE_BOARD_X + BASE_BOARD_W + BASE_GAP + BASE_TRAY + BASE_PAD;
const BASE_CANVAS_H = BASE_BOARD_Y + BASE_BOARD_W + BASE_GAP + BASE_TRAY + BASE_PAD + 16;

const BASE_TRAY_POSITIONS = [
  { x: BASE_PAD, y: BASE_BOARD_Y + 12 },
  { x: BASE_PAD, y: BASE_BOARD_Y + (BASE_BOARD_W - BASE_TRAY) / 2 },
  { x: BASE_PAD, y: BASE_BOARD_Y + BASE_BOARD_W - BASE_TRAY },
  { x: BASE_BOARD_X + BASE_BOARD_W + BASE_GAP, y: BASE_BOARD_Y + 12 },
  { x: BASE_BOARD_X + BASE_BOARD_W + BASE_GAP, y: BASE_BOARD_Y + (BASE_BOARD_W - BASE_TRAY) / 2 },
  { x: BASE_BOARD_X + BASE_BOARD_W + BASE_GAP, y: BASE_BOARD_Y + BASE_BOARD_W - BASE_TRAY },
  { x: BASE_BOARD_X, y: BASE_BOARD_Y + BASE_BOARD_W + BASE_GAP },
  { x: BASE_BOARD_X + (BASE_BOARD_W - BASE_TRAY) / 2, y: BASE_BOARD_Y + BASE_BOARD_W + BASE_GAP },
  { x: BASE_BOARD_X + BASE_BOARD_W - BASE_TRAY, y: BASE_BOARD_Y + BASE_BOARD_W + BASE_GAP },
] as const;

const PIECE_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
] as const;

type PiecePosMap = Record<string, number>;

interface PieceRenderProps {
  index: number;
  pieceSize: number;
  trayScale: number;
  boardSize: number;
  positions: SharedValue<PiecePosMap>;
  solvedFlags: SharedValue<boolean[]>;
  activePiece: SharedValue<number>;
  activeScale: SharedValue<number>;
  skiaImage: ReturnType<typeof useImage>;
}

function SkiaSpikePiece({
  index,
  pieceSize,
  trayScale,
  boardSize,
  positions,
  solvedFlags,
  activePiece,
  activeScale,
  skiaImage,
}: PieceRenderProps) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const clipPath = React.useMemo(() => {
    const edges = EDGE_TABLE[index] ?? [0, 0, 0, 0];
    return createJigsawSkiaPath(edges, 0, 0, pieceSize, pieceSize, pieceSize * 0.14);
  }, [index, pieceSize]);

  const origin = React.useMemo(
    () => ({ x: pieceSize / 2, y: pieceSize / 2 }),
    [pieceSize],
  );

  const transform = useDerivedValue(() => {
    const pos = positions.value;
    const isActive = activePiece.value === index;
    const isSolved = solvedFlags.value[index] === true;
    const pieceScale = isActive ? activeScale.value : isSolved ? 1 : trayScale;
    return [
      { translateX: pos[`x${index}`] ?? 0 },
      { translateY: pos[`y${index}`] ?? 0 },
      { scale: pieceScale },
    ];
  });

  const zIndex = useDerivedValue(() => {
    if (activePiece.value === index) return 20;
    return solvedFlags.value[index] ? 1 : 5;
  });

  const fillColor = PIECE_COLORS[index % PIECE_COLORS.length] ?? colors.blue;

  return (
    <Group transform={transform} origin={origin} zIndex={zIndex}>
      <Group clip={clipPath}>
        {skiaImage ? (
          <SkiaImage
            image={skiaImage}
            x={-col * pieceSize}
            y={-row * pieceSize}
            width={boardSize}
            height={boardSize}
            fit="cover"
          />
        ) : (
          <Rect
            x={-pieceSize}
            y={-pieceSize}
            width={pieceSize * 3}
            height={pieceSize * 3}
            color={fillColor}
          />
        )}
      </Group>
      <Path path={clipPath} color="#1e293b" style="stroke" strokeWidth={1.75} />
    </Group>
  );
}

function buildInitialPositions(
  scale: number,
  pieceSize: number,
  trayScale: number,
): PiecePosMap {
  const map: PiecePosMap = {};
  const offset = (pieceSize * (1 - trayScale)) / 2;
  for (let i = 0; i < TOTAL_PIECES; i++) {
    const pos = BASE_TRAY_POSITIONS[i];
    map[`x${i}`] = (pos?.x ?? 0) * scale - offset;
    map[`y${i}`] = (pos?.y ?? 0) * scale - offset;
  }
  return map;
}

function countSolved(flags: readonly boolean[]): number {
  'worklet';
  let total = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) total++;
  }
  return total;
}

export function SkiaJigsawSpike() {
  const { width: windowWidth } = useWindowDimensions();
  const canvasWidth = Math.min(windowWidth - 32, 460);
  const scale = canvasWidth / BASE_CANVAS_W;
  const canvasHeight = Math.round(BASE_CANVAS_H * scale);
  const pieceSize = BASE_PIECE * scale;
  const traySize = BASE_TRAY * scale;
  const boardX = BASE_BOARD_X * scale;
  const boardY = BASE_BOARD_Y * scale;
  const boardSize = BASE_BOARD_W * scale;
  const snapDist = 34 * scale;
  const trayScale = traySize / pieceSize;
  const trayCenterOffset = (pieceSize * (1 - trayScale)) / 2;

  const sampleImage = useImage(require('../../assets/items/pastel_nata.png'));

  const [solvedCount, setSolvedCount] = useState(0);
  const [misplacedCount, setMisplacedCount] = useState(0);

  const positions = useSharedValue<PiecePosMap>(
    buildInitialPositions(scale, pieceSize, trayScale),
  );
  const solvedFlags = useSharedValue<boolean[]>(Array(TOTAL_PIECES).fill(false));
  const activePiece = useSharedValue<number>(-1);
  const activeScale = useSharedValue<number>(trayScale);
  const dragStartX = useSharedValue<number>(0);
  const dragStartY = useSharedValue<number>(0);
  const didEndCleanly = useSharedValue<boolean>(false);

  const onDropResult = (snapped: boolean, totalSolved: number, countAsMiss: boolean) => {
    setSolvedCount(totalSolved);
    if (snapped) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (countAsMiss) {
      setMisplacedCount((prev) => prev + 1);
    }
  };

  const resetSpike = () => {
    activePiece.value = -1;
    activeScale.value = trayScale;
    solvedFlags.value = Array<boolean>(TOTAL_PIECES).fill(false);
    positions.value = withSpring(buildInitialPositions(scale, pieceSize, trayScale));
    setSolvedCount(0);
    setMisplacedCount(0);
  };

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      didEndCleanly.value = false;
      const current = positions.value;
      for (let i = TOTAL_PIECES - 1; i >= 0; i--) {
        if (solvedFlags.value[i]) continue;
        const px = current[`x${i}`] ?? 0;
        const py = current[`y${i}`] ?? 0;
        const left = px + trayCenterOffset;
        const top = py + trayCenterOffset;
        if (
          event.x >= left - 10 &&
          event.x <= left + traySize + 10 &&
          event.y >= top - 10 &&
          event.y <= top + traySize + 10
        ) {
          activePiece.value = i;
          dragStartX.value = px;
          dragStartY.value = py;
          activeScale.value = trayScale;
          activeScale.value = withSpring(1.06);
          break;
        }
      }
    })
    .onUpdate((event) => {
      'worklet';
      const idx = activePiece.value;
      if (idx < 0) return;
      positions.value = {
        ...positions.value,
        [`x${idx}`]: dragStartX.value + event.translationX,
        [`y${idx}`]: dragStartY.value + event.translationY,
      };
    })
    .onEnd(() => {
      'worklet';
      didEndCleanly.value = true;
      const idx = activePiece.value;
      if (idx < 0) return;

      const current = positions.value;
      const px = current[`x${idx}`] ?? 0;
      const py = current[`y${idx}`] ?? 0;

      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      const solvedX = boardX + col * pieceSize;
      const solvedY = boardY + row * pieceSize;
      const dist = Math.hypot(px - solvedX, py - solvedY);

      if (dist <= snapDist) {
        const nextFlags = [...solvedFlags.value];
        nextFlags[idx] = true;
        solvedFlags.value = nextFlags;
        activePiece.value = -1;
        activeScale.value = trayScale;
        positions.value = withSpring({
          ...current,
          [`x${idx}`]: solvedX,
          [`y${idx}`]: solvedY,
        });
        scheduleOnRN(onDropResult, true, countSolved(nextFlags), false);
      } else {
        const slot = BASE_TRAY_POSITIONS[idx];
        activePiece.value = -1;
        activeScale.value = trayScale;
        positions.value = withSpring({
          ...current,
          [`x${idx}`]: (slot?.x ?? 0) * scale - trayCenterOffset,
          [`y${idx}`]: (slot?.y ?? 0) * scale - trayCenterOffset,
        });
        scheduleOnRN(onDropResult, false, countSolved(solvedFlags.value), true);
      }
    })
    .onFinalize(() => {
      'worklet';
      const idx = activePiece.value;
      if (!didEndCleanly.value && idx >= 0) {
        const slot = BASE_TRAY_POSITIONS[idx];
        activePiece.value = -1;
        activeScale.value = trayScale;
        positions.value = withSpring({
          ...positions.value,
          [`x${idx}`]: (slot?.x ?? 0) * scale - trayCenterOffset,
          [`y${idx}`]: (slot?.y ?? 0) * scale - trayCenterOffset,
        });
      }
    });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Spike B: Skia 3x3 Jigsaw (60fps Test)</Text>
      <Text style={styles.meta}>
        Solved: {solvedCount}/{TOTAL_PIECES} • Misplaced: {misplacedCount}
      </Text>

      <GestureDetector gesture={panGesture}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          <RoundedRect
            x={boardX}
            y={boardY}
            width={boardSize}
            height={boardSize}
            r={8}
            color="#fef08a"
          />
          <RoundedRect
            x={boardX}
            y={boardY}
            width={boardSize}
            height={boardSize}
            r={8}
            color={colors.amber}
            style="stroke"
            strokeWidth={2}
          />
          {BASE_TRAY_POSITIONS.map((_, idx) => (
            <SkiaSpikePiece
              key={idx}
              index={idx}
              pieceSize={pieceSize}
              trayScale={trayScale}
              boardSize={boardSize}
              positions={positions}
              solvedFlags={solvedFlags}
              activePiece={activePiece}
              activeScale={activeScale}
              skiaImage={sampleImage}
            />
          ))}
        </Canvas>
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset jigsaw spike puzzle"
        onPress={resetSpike}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnText}>Reset Pieces</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.blueLight,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    alignSelf: 'flex-start',
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    alignSelf: 'flex-start',
  },
  btn: {
    minHeight: touchTargets.min,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
