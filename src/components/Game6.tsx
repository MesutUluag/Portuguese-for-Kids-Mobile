import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  makeImageFromView,
  Path,
  Rect,
  RoundedRect,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { Volume2 } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { cancelSpeech, speakAndSchedule, speakText } from '@/audio/speech';
import { GameScoreBadge } from '@/commons/GameScoreBadge';
import { kidsWords } from '@/core/data/index';
import type { Word } from '@/core/data/types';
import { colors, radii, shadows, touchTargets } from '@/theme/tokens';
import { GAME6_FALLBACK_POINTS, GAME6_PUZZLE_POINTS } from '@/utils/gameScoring';
import { EDGE_TABLE, createJigsawSkiaPath } from '@/utils/jigsawPath';
import { useWikiImage, WIKI_USER_AGENT } from '@/utils/useWikiImage';

export interface Game6Props {
  language: 'en' | 'tr';
  onScore?: (points: number) => void;
  score?: number;
  recentGain?: number | null;
  gainKey?: number;
  onInteractionLockChange?: (locked: boolean) => void;
}

const COLS = 3;
const ROWS = 3;
const TOTAL_PIECES = COLS * ROWS;

const BASE_PIECE = 82;
const BASE_BOARD_W = COLS * BASE_PIECE; // 246
const BASE_TRAY = 68;
const BASE_GAP = 14;
const BASE_PAD = 14;

const BASE_BOARD_X = BASE_PAD + BASE_TRAY + BASE_GAP; // 96
const BASE_BOARD_Y = 12;
const BASE_CANVAS_W = BASE_BOARD_X + BASE_BOARD_W + BASE_GAP + BASE_TRAY + BASE_PAD; // 438
const BASE_CANVAS_H = BASE_BOARD_Y + BASE_BOARD_W + BASE_GAP + BASE_TRAY + BASE_PAD + 14; // 356

const LX = BASE_PAD;
const RX = BASE_BOARD_X + BASE_BOARD_W + BASE_GAP;
const BY = BASE_BOARD_Y + BASE_BOARD_W + BASE_GAP;
const L_STEP = (BASE_BOARD_W - BASE_TRAY) / 2;
const B_STEP = (BASE_BOARD_W - BASE_TRAY) / 2;

const BASE_TRAY_POSITIONS = [
  { x: LX, y: BASE_BOARD_Y + 8, rot: -0.14 },
  { x: LX, y: BASE_BOARD_Y + L_STEP, rot: 0.12 },
  { x: LX, y: BASE_BOARD_Y + L_STEP * 2, rot: -0.15 },
  { x: RX, y: BASE_BOARD_Y + 8, rot: 0.13 },
  { x: RX, y: BASE_BOARD_Y + L_STEP, rot: -0.11 },
  { x: RX, y: BASE_BOARD_Y + L_STEP * 2, rot: 0.16 },
  { x: BASE_BOARD_X, y: BY, rot: -0.12 },
  { x: BASE_BOARD_X + B_STEP, y: BY, rot: 0.1 },
  { x: BASE_BOARD_X + B_STEP * 2, y: BY, rot: -0.11 },
] as const;

const NOUN_CATEGORIES = new Set([
  'Family',
  'Animals',
  'Food & Drink',
  'Body',
  'Clothes',
  'Home',
  'School',
  'Places',
  'Transport',
  'Nouns',
]);

const EXCLUDE_PATTERNS = [/\(m\)|\(f\)/, /\s/];

type PiecePosMap = Record<string, number>;

function buildShuffledSlots(): number[] {
  const slots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = slots[i];
    const b = slots[j];
    if (a !== undefined && b !== undefined) {
      slots[i] = b;
      slots[j] = a;
    }
  }
  return slots;
}

function buildBoardPositions(
  boardX: number,
  boardY: number,
  pieceSize: number,
): PiecePosMap {
  const map: PiecePosMap = {};
  for (let i = 0; i < TOTAL_PIECES; i += 1) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    map[`x${i}`] = boardX + col * pieceSize;
    map[`y${i}`] = boardY + row * pieceSize;
  }
  return map;
}

function buildTrayPositions(
  scale: number,
  trayCenterOffset: number,
  slots: readonly number[],
): PiecePosMap {
  const map: PiecePosMap = {};
  for (let i = 0; i < TOTAL_PIECES; i += 1) {
    const slotIdx = slots[i] ?? i;
    const pos = BASE_TRAY_POSITIONS[slotIdx];
    map[`x${i}`] = (pos?.x ?? 0) * scale - trayCenterOffset;
    map[`y${i}`] = (pos?.y ?? 0) * scale - trayCenterOffset;
  }
  return map;
}

function countSolved(flags: readonly boolean[]): number {
  'worklet';
  let total = 0;
  for (let i = 0; i < flags.length; i += 1) {
    if (flags[i]) total += 1;
  }
  return total;
}

const WIKI_IMAGE_HEADERS: Record<string, string> = {
  'User-Agent': WIKI_USER_AGENT,
  Accept: 'image/jpeg,image/png,image/webp,image/*,*/*;q=0.8',
};

async function loadSkiaImageFromUrl(
  wikiUrl: string,
  signal: AbortSignal,
): Promise<SkImage | null> {
  // Strategy 1 (Native): download to local cache via native URLSession/OkHttp,
  // then decode from file:// via Skia.Data.fromURI to avoid JS stream/ArrayBuffer bridges.
  if (Platform.OS !== 'web' && typeof File?.downloadFileAsync === 'function' && Paths?.cache) {
    const tempFile = new File(
      Paths.cache,
      `game6-puzzle-${Date.now()}-${Math.floor(Math.random() * 1e6)}.img`,
    );
    try {
      const downloaded = await File.downloadFileAsync(wikiUrl, tempFile, {
        headers: WIKI_IMAGE_HEADERS,
        idempotent: true,
        signal,
      });
      if (signal.aborted) return null;
      if (typeof Skia.Data.fromURI === 'function') {
        const skData = await Skia.Data.fromURI(downloaded.uri);
        const decoded = Skia.Image.MakeImageFromEncoded(skData);
        if (decoded) return decoded;
      }
    } catch {
      // Fall through to fetch/fromURI strategies
    } finally {
      try {
        if (tempFile.exists) {
          tempFile.delete();
        }
      } catch {
        // Ignore temp cache cleanup failure
      }
    }
  }

  // Strategy 2: fetch bytes and copy into a plain JS Uint8Array for Skia.Data.fromBytes
  try {
    const init: RequestInit =
      Platform.OS === 'web'
        ? { signal }
        : { headers: WIKI_IMAGE_HEADERS, signal };
    const res = await fetch(wikiUrl, init);
    if (res.ok && !signal.aborted) {
      const buf = await res.arrayBuffer();
      if (!signal.aborted && buf.byteLength > 0) {
        const copied = new Uint8Array(buf.byteLength);
        copied.set(new Uint8Array(buf));
        const skData = Skia.Data.fromBytes(copied);
        const decoded = Skia.Image.MakeImageFromEncoded(skData);
        if (decoded) return decoded;
      }
    }
  } catch {
    // Fall through to direct URI strategy
  }

  // Strategy 3: direct Skia.Data.fromURI
  if (!signal.aborted && typeof Skia.Data.fromURI === 'function') {
    try {
      const skData = await Skia.Data.fromURI(wikiUrl);
      const decoded = Skia.Image.MakeImageFromEncoded(skData);
      if (decoded) return decoded;
    } catch {
      // All strategies failed
    }
  }

  return null;
}

function useSkiaWikiImage(
  wikiUrl: string | null,
  onError?: () => void,
): SkImage | null {
  const [result, setResult] = useState<{
    url: string | null;
    image: SkImage | null;
  }>({ url: null, image: null });
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!wikiUrl) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const decoded = await loadSkiaImageFromUrl(wikiUrl, controller.signal);
        if (cancelled) return;
        if (decoded) {
          setResult({ url: wikiUrl, image: decoded });
        } else {
          if (__DEV__) {
            console.warn('[Game6] Failed to decode puzzle image:', wikiUrl);
          }
          setResult({ url: wikiUrl, image: null });
          onErrorRef.current?.();
        }
      } catch (err) {
        if (!cancelled) {
          if (__DEV__) {
            console.warn('[Game6] Puzzle image load error:', err);
          }
          setResult({ url: wikiUrl, image: null });
          onErrorRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [wikiUrl]);

  if (!wikiUrl || result.url !== wikiUrl) {
    return null;
  }
  return result.image;
}

interface JigsawPieceProps {
  index: number;
  traySlot: number;
  pieceSize: number;
  trayScale: number;
  boardSize: number;
  reduceMotion: boolean;
  positions: SharedValue<PiecePosMap>;
  activeDragX: SharedValue<number>;
  activeDragY: SharedValue<number>;
  solvedFlags: SharedValue<boolean[]>;
  activePiece: SharedValue<number>;
  activeScale: SharedValue<number>;
  splitProgress: SharedValue<number>;
  skImage: SkImage | null;
}

function SkiaJigsawPiece({
  index,
  traySlot,
  pieceSize,
  trayScale,
  boardSize,
  reduceMotion,
  positions,
  activeDragX,
  activeDragY,
  solvedFlags,
  activePiece,
  activeScale,
  splitProgress,
  skImage,
}: JigsawPieceProps) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const clipPath = useMemo(() => {
    const edges = EDGE_TABLE[index] ?? [0, 0, 0, 0];
    return createJigsawSkiaPath(edges, 0, 0, pieceSize, pieceSize, pieceSize * 0.18);
  }, [index, pieceSize]);

  const origin = useMemo(
    () => ({ x: pieceSize / 2, y: pieceSize / 2 }),
    [pieceSize],
  );

  const trayRot = reduceMotion ? 0 : (BASE_TRAY_POSITIONS[traySlot]?.rot ?? 0);

  const transform = useDerivedValue(() => {
    const isActive = activePiece.value === index;
    const isSolved = solvedFlags.value[index] === true;
    const t = splitProgress.value;
    const pos = positions.value;
    const tx = isActive ? activeDragX.value : (pos[`x${index}`] ?? 0);
    const ty = isActive ? activeDragY.value : (pos[`y${index}`] ?? 0);
    const pieceScale = isActive
      ? activeScale.value
      : isSolved
        ? 1
        : 1 + (trayScale - 1) * t;
    const pieceRot = isActive || isSolved ? 0 : trayRot * t;
    return [
      { translateX: tx },
      { translateY: ty },
      { scale: pieceScale },
      { rotate: pieceRot },
    ];
  });

  const zIndex = useDerivedValue(() => {
    if (activePiece.value === index) return 20;
    return solvedFlags.value[index] ? 1 : 5;
  });

  const isSolvedDerived = useDerivedValue(() => solvedFlags.value[index] === true);
  const strokeColor = useDerivedValue(() =>
    isSolvedDerived.value ? 'rgba(120, 80, 30, 0.25)' : 'rgba(60, 40, 10, 0.60)',
  );
  const strokeWidth = useDerivedValue(() => (isSolvedDerived.value ? 1 : 1.6));

  return (
    <Group transform={transform} origin={origin} zIndex={zIndex}>
      <Group clip={clipPath}>
        {skImage ? (
          <SkiaImage
            image={skImage}
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
            color="#e8d5b0"
          />
        )}
      </Group>
      <Path
        path={clipPath}
        color={strokeColor}
        style="stroke"
        strokeWidth={strokeWidth}
      />
    </Group>
  );
}

interface BoardGhostSlotsProps {
  boardX: number;
  boardY: number;
  pieceSize: number;
  previewMode?: boolean;
}

const BoardGhostSlots = React.memo(function BoardGhostSlots({
  boardX,
  boardY,
  pieceSize,
  previewMode = false,
}: BoardGhostSlotsProps) {
  const ghostPaths = useMemo(() => {
    return EDGE_TABLE.map((edges, idx) => {
      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      return createJigsawSkiaPath(
        edges,
        boardX + col * pieceSize,
        boardY + row * pieceSize,
        pieceSize,
        pieceSize,
        pieceSize * 0.18,
      );
    });
  }, [boardX, boardY, pieceSize]);

  return (
    <>
      {ghostPaths.map((path, idx) => (
        <React.Fragment key={idx}>
          {!previewMode ? (
            <Path path={path} color="rgba(140, 95, 40, 0.10)" />
          ) : null}
          <Path
            path={path}
            color={previewMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(140, 95, 40, 0.32)'}
            style="stroke"
            strokeWidth={previewMode ? 1.4 : 1.3}
          />
        </React.Fragment>
      ))}
    </>
  );
});

interface JigsawStageProps {
  canvasWidth: number;
  canvasHeight: number;
  boardX: number;
  boardY: number;
  boardSize: number;
  pieceSize: number;
  traySize: number;
  trayScale: number;
  trayCenterOffset: number;
  scale: number;
  snapDist: number;
  phase: 'preview' | 'playing';
  roundId: number;
  traySlots: number[];
  reduceMotion: boolean;
  skImage: SkImage | null;
  positions: SharedValue<PiecePosMap>;
  activeDragX: SharedValue<number>;
  activeDragY: SharedValue<number>;
  solvedFlags: SharedValue<boolean[]>;
  activePiece: SharedValue<number>;
  activeScale: SharedValue<number>;
  splitProgress: SharedValue<number>;
  dragStartX: SharedValue<number>;
  dragStartY: SharedValue<number>;
  canDragSV: SharedValue<boolean>;
  didEndCleanly: SharedValue<boolean>;
  traySlotsSV: SharedValue<number[]>;
  onDragLockChange: (locked: boolean) => void;
  onDropResult: (snapped: boolean, totalSolved: number) => void;
}

const JigsawStage = React.memo(function JigsawStage({
  canvasWidth,
  canvasHeight,
  boardX,
  boardY,
  boardSize,
  pieceSize,
  traySize,
  trayScale,
  trayCenterOffset,
  scale,
  snapDist,
  phase,
  roundId,
  traySlots,
  reduceMotion,
  skImage,
  positions,
  activeDragX,
  activeDragY,
  solvedFlags,
  activePiece,
  activeScale,
  splitProgress,
  dragStartX,
  dragStartY,
  canDragSV,
  didEndCleanly,
  traySlotsSV,
  onDragLockChange,
  onDropResult,
}: JigsawStageProps) {
  const panGesture = Gesture.Pan()
    .minDistance(2)
    .onBegin((event) => {
      'worklet';
      if (!canDragSV.get()) return;
      didEndCleanly.set(false);
      const current = positions.get();
      const flags = solvedFlags.get();
      for (let i = TOTAL_PIECES - 1; i >= 0; i -= 1) {
        if (flags[i]) continue;
        const px = current[`x${i}`] ?? 0;
        const py = current[`y${i}`] ?? 0;
        const left = px + trayCenterOffset;
        const top = py + trayCenterOffset;
        if (
          event.x >= left - 12 &&
          event.x <= left + traySize + 12 &&
          event.y >= top - 12 &&
          event.y <= top + traySize + 12
        ) {
          activeDragX.set(px);
          activeDragY.set(py);
          activePiece.set(i);
          dragStartX.set(px);
          dragStartY.set(py);
          activeScale.set(reduceMotion ? 1.04 : withSpring(1.04));
          scheduleOnRN(onDragLockChange, true);
          break;
        }
      }
    })
    .onUpdate((event) => {
      'worklet';
      const idx = activePiece.get();
      if (idx < 0) return;
      activeDragX.set(dragStartX.get() + event.translationX);
      activeDragY.set(dragStartY.get() + event.translationY);
    })
    .onEnd(() => {
      'worklet';
      didEndCleanly.set(true);
      const idx = activePiece.get();
      if (idx < 0) return;

      const current = positions.get();
      const px = activeDragX.get();
      const py = activeDragY.get();
      const releaseMap = {
        ...current,
        [`x${idx}`]: px,
        [`y${idx}`]: py,
      };
      positions.set(releaseMap);

      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      const solvedX = boardX + col * pieceSize;
      const solvedY = boardY + row * pieceSize;
      // Compare piece visual centers so trayCenterOffset & activeScale never shift snap distance
      const pieceCenterX = px + pieceSize / 2;
      const pieceCenterY = py + pieceSize / 2;
      const targetCenterX = solvedX + pieceSize / 2;
      const targetCenterY = solvedY + pieceSize / 2;
      const dist = Math.hypot(pieceCenterX - targetCenterX, pieceCenterY - targetCenterY);

      if (dist <= snapDist) {
        const nextFlags = [...solvedFlags.get()];
        nextFlags[idx] = true;
        solvedFlags.set(nextFlags);
        activePiece.set(-1);
        activeScale.set(1);
        const snappedMap = {
          ...releaseMap,
          [`x${idx}`]: solvedX,
          [`y${idx}`]: solvedY,
        };
        positions.set(reduceMotion ? snappedMap : withSpring(snappedMap));
        scheduleOnRN(onDropResult, true, countSolved(nextFlags));
      } else {
        const slotIdx = traySlotsSV.get()[idx] ?? idx;
        const slot = BASE_TRAY_POSITIONS[slotIdx];
        activePiece.set(-1);
        activeScale.set(trayScale);
        const resetMap = {
          ...releaseMap,
          [`x${idx}`]: (slot?.x ?? 0) * scale - trayCenterOffset,
          [`y${idx}`]: (slot?.y ?? 0) * scale - trayCenterOffset,
        };
        positions.set(reduceMotion ? resetMap : withSpring(resetMap));
        scheduleOnRN(onDropResult, false, countSolved(solvedFlags.get()));
      }
    })
    .onFinalize(() => {
      'worklet';
      scheduleOnRN(onDragLockChange, false);
      const idx = activePiece.get();
      if (!didEndCleanly.get() && idx >= 0) {
        const slotIdx = traySlotsSV.get()[idx] ?? idx;
        const slot = BASE_TRAY_POSITIONS[slotIdx];
        const releaseMap = {
          ...positions.get(),
          [`x${idx}`]: activeDragX.get(),
          [`y${idx}`]: activeDragY.get(),
        };
        positions.set(releaseMap);
        activePiece.set(-1);
        activeScale.set(trayScale);
        const resetMap = {
          ...releaseMap,
          [`x${idx}`]: (slot?.x ?? 0) * scale - trayCenterOffset,
          [`y${idx}`]: (slot?.y ?? 0) * scale - trayCenterOffset,
        };
        positions.set(reduceMotion ? resetMap : withSpring(resetMap));
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
        <RoundedRect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          r={14}
          color="#ede0c4"
        />
        <RoundedRect
          x={boardX - 7}
          y={boardY - 7}
          width={boardSize + 14}
          height={boardSize + 14}
          r={6}
          color="#ffffff"
        />
        <Rect
          x={boardX}
          y={boardY}
          width={boardSize}
          height={boardSize}
          color="#e8d4b0"
        />
        <Rect
          x={boardX + 0.75}
          y={boardY + 0.75}
          width={boardSize - 1.5}
          height={boardSize - 1.5}
          color="rgba(160, 110, 55, 0.40)"
          style="stroke"
          strokeWidth={1.5}
        />

        {!skImage ? null : phase === 'preview' ? (
          <>
            <SkiaImage
              image={skImage}
              x={boardX}
              y={boardY}
              width={boardSize}
              height={boardSize}
              fit="cover"
            />
            <BoardGhostSlots
              boardX={boardX}
              boardY={boardY}
              pieceSize={pieceSize}
              previewMode
            />
          </>
        ) : (
          <>
            <BoardGhostSlots
              boardX={boardX}
              boardY={boardY}
              pieceSize={pieceSize}
            />
            <Group>
              {traySlots.map((traySlot, idx) => (
                <SkiaJigsawPiece
                  key={`${roundId}-${idx}`}
                  index={idx}
                  traySlot={traySlot}
                  pieceSize={pieceSize}
                  trayScale={trayScale}
                  boardSize={boardSize}
                  reduceMotion={reduceMotion}
                  positions={positions}
                  activeDragX={activeDragX}
                  activeDragY={activeDragY}
                  solvedFlags={solvedFlags}
                  activePiece={activePiece}
                  activeScale={activeScale}
                  splitProgress={splitProgress}
                  skImage={skImage}
                />
              ))}
            </Group>
          </>
        )}
      </Canvas>
    </GestureDetector>
  );
});

interface PosterPalette {
  bg: string;
  blob1: string;
  blob2: string;
  ring: string;
}

const POSTER_PALETTES: PosterPalette[] = [
  { bg: '#fef3c7', blob1: '#fde68a', blob2: '#fed7aa', ring: '#f59e0b' },
  { bg: '#dbeafe', blob1: '#bfdbfe', blob2: '#e0e7ff', ring: '#3b82f6' },
  { bg: '#dcfce7', blob1: '#bbf7d0', blob2: '#fef9c3', ring: '#16a34a' },
  { bg: '#fce7f3', blob1: '#fbcfe8', blob2: '#fae8ff', ring: '#ec4899' },
  { bg: '#e0f2fe', blob1: '#bae6fd', blob2: '#ccfbf1', ring: '#0284c7' },
  { bg: '#f3e8ff', blob1: '#e9d5ff', blob2: '#fce7f3', ring: '#9333ea' },
];

function getPosterPalette(category: string): PosterPalette {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % POSTER_PALETTES.length;
  return POSTER_PALETTES[index] ?? POSTER_PALETTES[0]!;
}

export function Game6({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
  onInteractionLockChange,
}: Game6Props) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();

  const canvasWidth = Math.max(280, Math.min(windowWidth - 52, 460));
  const scale = canvasWidth / BASE_CANVAS_W;
  const canvasHeight = Math.round(BASE_CANVAS_H * scale);
  const pieceSize = BASE_PIECE * scale;
  const traySize = BASE_TRAY * scale;
  const boardX = BASE_BOARD_X * scale;
  const boardY = BASE_BOARD_Y * scale;
  const boardSize = BASE_BOARD_W * scale;
  const snapDist = 36 * scale;
  const trayScale = traySize / pieceSize;
  const trayCenterOffset = (pieceSize * (1 - trayScale)) / 2;

  const puzzleWords = useMemo(
    () =>
      kidsWords.filter(
        (w) =>
          NOUN_CATEGORIES.has(w.category) &&
          !EXCLUDE_PATTERNS.some((re) => re.test(w.en)),
      ),
    [],
  );

  const pickNextWord = useCallback(
    (previous?: Word | null): Word => {
      if (puzzleWords.length === 0) return kidsWords[0]!;
      let next = puzzleWords[Math.floor(Math.random() * puzzleWords.length)] ?? puzzleWords[0]!;
      if (puzzleWords.length > 1) {
        let guard = 0;
        while (next.pt === previous?.pt && guard < 12) {
          next = puzzleWords[Math.floor(Math.random() * puzzleWords.length)] ?? puzzleWords[0]!;
          guard += 1;
        }
      }
      return next;
    },
    [puzzleWords],
  );

  const [roundState, setRoundState] = useState<{
    roundId: number;
    target: Word;
    traySlots: number[];
    retryCount: number;
    timedOut: boolean;
  }>(() => ({
    roundId: 1,
    target: pickNextWord(null),
    traySlots: buildShuffledSlots(),
    retryCount: 0,
    timedOut: false,
  }));

  const [scatteredRoundId, setScatteredRoundId] = useState<number | null>(null);
  const [posterResult, setPosterResult] = useState<{
    roundId: number;
    image: SkImage | null;
  }>({ roundId: 0, image: null });
  const [roundSolved, setRoundSolved] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);

  const phase: 'preview' | 'playing' =
    scatteredRoundId === roundState.roundId ? 'playing' : 'preview';
  const fallbackTimedOut = roundState.timedOut;

  const langRef = useRef(language);
  const solvedRef = useRef(false);
  const posterRef = useRef<React.ComponentRef<typeof View>>(null);
  const posterCapturedRef = useRef<number>(0);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAdvanceRef = useRef<(() => void) | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScoreRef = useRef(onScore);
  const lockChangeRef = useRef(onInteractionLockChange);

  useEffect(() => {
    langRef.current = language;
  }, [language]);

  useEffect(() => {
    onScoreRef.current = onScore;
  }, [onScore]);

  useEffect(() => {
    lockChangeRef.current = onInteractionLockChange;
  }, [onInteractionLockChange]);

  const positions = useSharedValue<PiecePosMap>(
    buildBoardPositions(boardX, boardY, pieceSize),
  );
  const solvedFlags = useSharedValue<boolean[]>(Array<boolean>(TOTAL_PIECES).fill(false));
  const activePiece = useSharedValue<number>(-1);
  const activeScale = useSharedValue<number>(trayScale);
  const splitProgress = useSharedValue<number>(0);
  const dragStartX = useSharedValue<number>(0);
  const dragStartY = useSharedValue<number>(0);
  const activeDragX = useSharedValue<number>(0);
  const activeDragY = useSharedValue<number>(0);
  const didEndCleanly = useSharedValue<boolean>(false);
  const traySlotsSV = useSharedValue<number[]>(roundState.traySlots);
  const canDragSV = useSharedValue<boolean>(false);

  useEffect(() => {
    traySlotsSV.set(roundState.traySlots);
  }, [roundState.traySlots, traySlotsSV]);

  useEffect(() => {
    canDragSV.set(phase === 'playing' && !roundSolved);
  }, [canDragSV, phase, roundSolved]);

  const handleImageError = useCallback(() => {
    setRoundState((prev) => {
      if (prev.timedOut || prev.retryCount >= 2 || solvedRef.current) {
        return prev;
      }
      return {
        ...prev,
        target: pickNextWord(prev.target),
        retryCount: prev.retryCount + 1,
      };
    });
  }, [pickNextWord]);

  const wikiUrl = useWikiImage(roundState.target.en);
  const skImage = useSkiaWikiImage(wikiUrl, handleImageError);

  const clearTimers = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (cancelAdvanceRef.current) {
      cancelAdvanceRef.current();
      cancelAdvanceRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const loadNextRound = useCallback(() => {
    clearTimers();
    lockChangeRef.current?.(false);
    solvedRef.current = false;
    activePiece.set(-1);
    activeDragX.set(0);
    activeDragY.set(0);
    activeScale.set(trayScale);
    splitProgress.set(0);
    solvedFlags.set(Array<boolean>(TOTAL_PIECES).fill(false));
    positions.set(buildBoardPositions(boardX, boardY, pieceSize));

    setScatteredRoundId(null);
    setRoundSolved(false);
    setSolvedCount(0);
    setRoundState((prev) => ({
      roundId: prev.roundId + 1,
      target: pickNextWord(prev.target),
      traySlots: buildShuffledSlots(),
      retryCount: 0,
      timedOut: false,
    }));
  }, [
    activeDragX,
    activeDragY,
    activePiece,
    activeScale,
    boardX,
    boardY,
    clearTimers,
    pickNextWord,
    pieceSize,
    positions,
    solvedFlags,
    splitProgress,
    trayScale,
  ]);

  // Speak word at start of each round
  useEffect(() => {
    speakText(roundState.target.pt, { language: langRef.current });
  }, [roundState.roundId, roundState.target.pt]);

  // 4-second fallback timeout matching web Game6
  useEffect(() => {
    const activeRound = roundState.roundId;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null;
      setRoundState((prev) =>
        prev.roundId === activeRound ? { ...prev, timedOut: true } : prev,
      );
    }, 4000);
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [roundState.roundId]);

  // When Wikipedia doesn't return an image before the 4s timeout,
  // snapshot a local illustrated word-poster View into an SkImage so
  // the 3x3 jigsaw puzzle stays playable offline or when Wikimedia blocks.
  useEffect(() => {
    if (!fallbackTimedOut || skImage) return undefined;
    if (posterCapturedRef.current === roundState.roundId) return undefined;
    posterCapturedRef.current = roundState.roundId;

    let cancelled = false;
    const activeRound = roundState.roundId;

    void (async () => {
      let generated: SkImage | null = null;
      if (posterRef.current && typeof makeImageFromView === 'function') {
        try {
          generated = await makeImageFromView(
            posterRef as unknown as React.RefObject<React.Component<unknown, unknown> | null>,
          );
        } catch {
          generated = null;
        }
      }
      if (!cancelled) {
        setPosterResult({ roundId: activeRound, image: generated });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackTimedOut, roundState.roundId, skImage]);

  const posterImage =
    posterResult.roundId === roundState.roundId ? posterResult.image : null;
  const activeImage = skImage ?? posterImage;
  const fallbackAttempted = posterResult.roundId === roundState.roundId;

  // When image loads, show completed puzzle preview briefly then split & scatter pieces to tray slots
  useEffect(() => {
    if (!activeImage) return undefined;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    splitProgress.set(0);
    positions.set(buildBoardPositions(boardX, boardY, pieceSize));

    const activeRound = roundState.roundId;
    const previewDelay = reduceMotion ? 900 : 1800;
    previewTimerRef.current = setTimeout(() => {
      previewTimerRef.current = null;
      setScatteredRoundId(activeRound);
      const trayMap = buildTrayPositions(
        scale,
        trayCenterOffset,
        roundState.traySlots,
      );
      positions.set(
        reduceMotion ? trayMap : withTiming(trayMap, { duration: 550 }),
      );
      splitProgress.set(
        reduceMotion ? 1 : withTiming(1, { duration: 550 }),
      );
    }, previewDelay);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, [
    activeImage,
    boardX,
    boardY,
    pieceSize,
    positions,
    reduceMotion,
    roundState.roundId,
    roundState.traySlots,
    scale,
    splitProgress,
    trayCenterOffset,
  ]);

  useEffect(() => {
    return () => {
      clearTimers();
      lockChangeRef.current?.(false);
      cancelSpeech();
    };
  }, [clearTimers]);

  const showFallback = !activeImage && fallbackTimedOut && fallbackAttempted;

  const handleDragLockChange = useCallback(
    (locked: boolean) => {
      onInteractionLockChange?.(locked);
    },
    [onInteractionLockChange],
  );

  const handleDropResult = useCallback((_snapped: boolean, totalSolved: number) => {
    setSolvedCount(totalSolved);
    if (totalSolved >= TOTAL_PIECES) {
      setRoundSolved(true);
    }
  }, []);

  useEffect(() => {
    if (!roundSolved || solvedRef.current) return;
    solvedRef.current = true;
    onScoreRef.current?.(GAME6_PUZZLE_POINTS);
    cancelAdvanceRef.current?.();
    cancelAdvanceRef.current = speakAndSchedule(roundState.target.pt, {
      language: langRef.current,
      minDelayMs: 1400,
      postSpeechPauseMs: 300,
      fallbackMs: 3500,
      onAdvance: () => {
        cancelAdvanceRef.current = null;
        loadNextRound();
      },
    });
  }, [loadNextRound, roundSolved, roundState.target.pt]);

  const handleFallbackComplete = () => {
    onScoreRef.current?.(GAME6_FALLBACK_POINTS);
    loadNextRound();
  };

  const target = roundState.target;
  const translation = isTr ? target.tr : target.en;
  const palette = getPosterPalette(target.category);
  const posterBoxSize = Math.max(180, Math.round(boardSize));

  return (
    <View style={styles.outerWrap}>
      {/* Hidden behind opaque card so drawViewHierarchyInRect renders a real Skia poster offline */}
      <View
        ref={posterRef}
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.posterScene,
          {
            width: posterBoxSize,
            height: posterBoxSize,
            backgroundColor: palette.bg,
          },
        ]}
      >
        <View
          style={[
            styles.posterBlobTopLeft,
            {
              backgroundColor: palette.blob1,
              width: Math.round(posterBoxSize * 0.65),
              height: Math.round(posterBoxSize * 0.65),
              borderRadius: Math.round(posterBoxSize * 0.325),
            },
          ]}
        />
        <View
          style={[
            styles.posterBlobBottomRight,
            {
              backgroundColor: palette.blob2,
              width: Math.round(posterBoxSize * 0.6),
              height: Math.round(posterBoxSize * 0.6),
              borderRadius: Math.round(posterBoxSize * 0.3),
            },
          ]}
        />
        <View
          style={[
            styles.posterInnerFrame,
            {
              borderColor: palette.ring,
            },
          ]}
        >
          <Text
            style={[
              styles.posterEmoji,
              {
                fontSize: Math.round(posterBoxSize * 0.5),
                lineHeight: Math.round(posterBoxSize * 0.6),
              },
            ]}
          >
            {target.emoji}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          roundSolved && styles.cardSolved,
        ]}
      >
        <GameScoreBadge
          score={score}
          recentGain={recentGain}
          gainKey={gainKey}
          language={language}
        />

        <Text style={styles.title} maxFontSizeMultiplier={1.25}>
          {isTr ? '🧩 Yapboz' : '🧩 Puzzle'}
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.25}>
          {isTr ? 'Parçaları doğru yere sürükle!' : 'Drag the pieces to the right place!'}
        </Text>

        {showFallback ? (
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackEmoji}>{target.emoji}</Text>
            <Pressable
              onPress={() => speakText(target.pt, { language })}
              accessibilityRole="button"
              accessibilityLabel={isTr ? `${target.pt} seslendir` : `Speak ${target.pt}`}
              style={styles.wordBtn}
            >
              <Text style={styles.wordLabel} maxFontSizeMultiplier={1.25}>
                {target.pt}
              </Text>
              <Volume2 size={18} strokeWidth={2.4} color={colors.rose} />
            </Pressable>
            <Text style={styles.wordMeaning} maxFontSizeMultiplier={1.2}>
              {translation}
            </Text>
            <Pressable
              onPress={handleFallbackComplete}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Anladım, sonraki kelime' : 'Got it, next word'}
              style={({ pressed }) => [
                styles.fallbackBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.fallbackBtnText} maxFontSizeMultiplier={1.2}>
                {isTr ? '✓ Anladım!' : '✓ Got it!'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.stageWrapper}>
            <View style={[styles.canvasShadowWrap, { width: canvasWidth, height: canvasHeight }]}>
              <JigsawStage
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                boardX={boardX}
                boardY={boardY}
                boardSize={boardSize}
                pieceSize={pieceSize}
                traySize={traySize}
                trayScale={trayScale}
                trayCenterOffset={trayCenterOffset}
                scale={scale}
                snapDist={snapDist}
                phase={phase}
                roundId={roundState.roundId}
                traySlots={roundState.traySlots}
                reduceMotion={reduceMotion}
                skImage={activeImage}
                positions={positions}
                activeDragX={activeDragX}
                activeDragY={activeDragY}
                solvedFlags={solvedFlags}
                activePiece={activePiece}
                activeScale={activeScale}
                splitProgress={splitProgress}
                dragStartX={dragStartX}
                dragStartY={dragStartY}
                canDragSV={canDragSV}
                didEndCleanly={didEndCleanly}
                traySlotsSV={traySlotsSV}
                onDragLockChange={handleDragLockChange}
                onDropResult={handleDropResult}
              />

              {!activeImage ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.boardSpinnerOverlay,
                    {
                      left: boardX,
                      top: boardY,
                      width: boardSize,
                      height: boardSize,
                    },
                  ]}
                >
                  <ActivityIndicator size="large" color="#a8692e" />
                </View>
              ) : null}
            </View>

            <Text style={styles.progressMeta} maxFontSizeMultiplier={1.2}>
              {roundSolved
                ? isTr
                  ? 'Harika! 🎉'
                  : 'Awesome! 🎉'
                : phase === 'preview'
                  ? isTr
                    ? 'Resme iyi bak...'
                    : 'Look closely...'
                  : `${solvedCount} / ${TOTAL_PIECES}`}
            </Text>

            <Pressable
              onPress={() => speakText(target.pt, { language })}
              accessibilityRole="button"
              accessibilityLabel={isTr ? `${target.pt} seslendir` : `Speak ${target.pt}`}
              style={styles.wordBtn}
            >
              <Text style={styles.wordLabel} maxFontSizeMultiplier={1.25}>
                {target.pt}
              </Text>
              <Volume2 size={18} strokeWidth={2.4} color={colors.rose} />
            </Pressable>
            <Text style={styles.wordMeaning} maxFontSizeMultiplier={1.2}>
              {translation}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'relative',
  },
  posterScene: {
    position: 'absolute',
    top: 32,
    left: 32,
    zIndex: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBlobTopLeft: {
    position: 'absolute',
    top: -28,
    left: -24,
    opacity: 0.75,
  },
  posterBlobBottomRight: {
    position: 'absolute',
    bottom: -24,
    right: -20,
    opacity: 0.75,
  },
  posterInnerFrame: {
    width: '84%',
    height: '84%',
    borderRadius: 24,
    borderWidth: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterEmoji: {
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3.5,
    borderColor: colors.rose,
    padding: 16,
    gap: 8,
    position: 'relative',
    zIndex: 1,
    ...shadows.md,
  },
  cardSolved: {
    borderColor: colors.green,
    backgroundColor: '#f0fdf4',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.rose,
    paddingRight: 72,
  },
  subtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
  },
  stageWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  canvasShadowWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.sm,
  },
  boardSpinnerOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(232, 212, 176, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressMeta: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400e',
    marginTop: 2,
  },
  wordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 36,
  },
  wordLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.rose,
    textAlign: 'center',
  },
  wordMeaning: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  fallbackBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  fallbackEmoji: {
    fontSize: 72,
    lineHeight: 84,
  },
  fallbackBtn: {
    marginTop: 6,
    minHeight: touchTargets.min,
    paddingHorizontal: 28,
    borderRadius: radii.md,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  fallbackBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
