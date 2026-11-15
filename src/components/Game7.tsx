import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Volume2 } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { cancelSpeech, speakText } from '@/audio/speech';
import { GameScoreBadge } from '@/commons/GameScoreBadge';
import { marketItems, type MobileMarketItem } from '@/data/marketItems.mobile';
import { colors, radii, shadows, touchTargets } from '@/theme/tokens';
import { scoreGame7 } from '@/utils/gameScoring';
import {
  buildMarketCountSpeech,
  buildMarketOrderText,
} from '@/utils/marketOrder';

type RNViewRef = React.ComponentRef<typeof View>;

export interface Game7Props {
  language: 'en' | 'tr';
  onScore?: (points: number) => void;
  score?: number;
  recentGain?: number | null;
  gainKey?: number;
  onInteractionLockChange?: (locked: boolean) => void;
}

type MascotState = 'idle' | 'happy' | 'sad' | 'talking';
type CartVisualState = 'idle' | 'dragOver' | 'bounce' | 'exit' | 'enter';

interface CartItemEntry {
  id: string;
  item: MobileMarketItem;
}

interface FlyingItemEntry {
  id: string;
  item: MobileMarketItem;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CART_CAPACITY = 15;
const CART_FRAME_W = 256;
const CART_FRAME_H = 146;
const CART_COL_PCT = [0.04, 0.28, 0.54, 0.78] as const;
const CART_COL_X = ['4%', '28%', '54%', '78%'] as const;
const CART_ROTS = ['-9deg', '5deg', '-5deg', '8deg'] as const;
const CONFETTI_COLORS = [
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f97316',
  '#ec4899',
  '#14b8a6',
] as const;

function shuffleMarketItems(list: readonly MobileMarketItem[]): MobileMarketItem[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function buildRound(recentIds: readonly string[]): {
  shelf: MobileMarketItem[];
  target: MobileMarketItem;
  count: number;
  nextRecent: string[];
} {
  const shelf = shuffleMarketItems(marketItems).slice(0, 8);
  const candidates = shelf.filter((item) => !recentIds.includes(item.id));
  const pool = candidates.length > 0 ? candidates : shelf;
  const target = pool[Math.floor(Math.random() * pool.length)] ?? shelf[0] ?? marketItems[0]!;
  const count = Math.floor(Math.random() * 3) + 1;
  return {
    shelf,
    target,
    count,
    nextRecent: [target.id, ...recentIds].slice(0, 4),
  };
}

function MarketItemVisual({
  item,
  size = 34,
}: {
  item: MobileMarketItem;
  size?: number;
}) {
  if (item.iconAsset != null) {
    const imgSize = item.id === 'pastel_nata' && size >= 32 ? size + 8 : size;
    return (
      <Image
        source={item.iconAsset}
        style={{ width: imgSize, height: imgSize }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <Text
      style={{
        fontSize: Math.round(size * 0.92),
        lineHeight: Math.round(size * 1.12),
        textAlign: 'center',
      }}
    >
      {item.icon}
    </Text>
  );
}

const BunnyMascot = React.memo(function BunnyMascot({
  state,
  language,
  onPress,
}: {
  state: MascotState;
  language: 'en' | 'tr';
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isTr = language === 'tr';
  const isHappy = state === 'happy';
  const isSad = state === 'sad';
  const isTalking = state === 'talking';

  const bounceY = useSharedValue(0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(bounceY);
    cancelAnimation(shakeX);
    if (reduceMotion) {
      bounceY.value = 0;
      shakeX.value = 0;
      return;
    }
    if (isHappy) {
      bounceY.value = withRepeat(
        withSequence(
          withTiming(-9, { duration: 180 }),
          withTiming(0, { duration: 180 }),
        ),
        3,
        false,
      );
    } else if (isSad) {
      shakeX.value = withSequence(
        withTiming(-4, { duration: 70 }),
        withTiming(4, { duration: 70 }),
        withTiming(-3, { duration: 70 }),
        withTiming(3, { duration: 70 }),
        withTiming(0, { duration: 70 }),
      );
    } else if (isTalking) {
      bounceY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 160 }),
          withTiming(0, { duration: 160 }),
        ),
        -1,
        false,
      );
    } else {
      bounceY.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [bounceY, isHappy, isSad, isTalking, reduceMotion, shakeX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: bounceY.value }],
  }));

  const mouthD = isHappy
    ? 'M40 66 Q50 76 60 66'
    : isSad
      ? 'M42 70 Q50 63 58 70'
      : isTalking
        ? 'M42 65 Q50 74 58 65'
        : 'M42 65 Q50 71 58 65';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isTr ? 'Tavşan maskotu dinle' : 'Tap bunny mascot to listen'
      }
      hitSlop={6}
      style={({ pressed }) => [styles.bunnyWrap, pressed && styles.pressedSoft]}
    >
      {isHappy ? <Text style={styles.bunnyStars}>💖 ✨ 💖</Text> : null}
      <Animated.View style={animStyle}>
        <Svg width={74} height={86} viewBox="0 0 100 116">
          <Defs>
            <RadialGradient id="bmFur" cx="48%" cy="38%" r="58%">
              <Stop offset="0%" stopColor="#fde3c0" />
              <Stop offset="45%" stopColor="#f97316" />
              <Stop offset="100%" stopColor="#c2410c" />
            </RadialGradient>
            <RadialGradient id="bmEar" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#fecaca" />
              <Stop offset="100%" stopColor="#f87171" />
            </RadialGradient>
            <RadialGradient id="bmBelly" cx="50%" cy="40%" r="60%">
              <Stop offset="0%" stopColor="#fff7ed" />
              <Stop offset="100%" stopColor="#fed7aa" />
            </RadialGradient>
            <LinearGradient id="bmOverall" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#60a5fa" />
              <Stop offset="100%" stopColor="#2563eb" />
            </LinearGradient>
          </Defs>

          {/* Left ear */}
          <Ellipse cx={30} cy={26} rx={10} ry={24} fill="url(#bmFur)" />
          <Ellipse cx={30} cy={26} rx={5.5} ry={17} fill="url(#bmEar)" />
          {/* Right ear */}
          <Ellipse cx={70} cy={26} rx={10} ry={24} fill="url(#bmFur)" />
          <Ellipse cx={70} cy={26} rx={5.5} ry={17} fill="url(#bmEar)" />

          {/* Overalls body */}
          <Ellipse cx={50} cy={96} rx={26} ry={18} fill="url(#bmOverall)" />
          <Rect x={38} y={76} width={24} height={22} rx={5} fill="url(#bmOverall)" />
          <Rect x={44} y={83} width={12} height={8} rx={2.5} fill="none" stroke="#93c5fd" strokeWidth={1.2} />

          {/* Arms */}
          <Path d="M28 78 Q17 90 20 102" stroke="url(#bmFur)" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Circle cx={20} cy={103} r={6} fill="url(#bmFur)" />
          <Path d="M72 78 Q83 90 80 102" stroke="url(#bmFur)" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Circle cx={80} cy={103} r={6} fill="url(#bmFur)" />

          {/* Belly patch */}
          <Ellipse cx={50} cy={90} rx={14} ry={9} fill="url(#bmBelly)" opacity={0.7} />

          {/* Head */}
          <Ellipse cx={50} cy={58} rx={28} ry={27} fill="url(#bmFur)" />
          <Ellipse cx={50} cy={65} rx={14} ry={11} fill="url(#bmBelly)" />

          {/* Blush */}
          <Ellipse cx={28} cy={63} rx={7} ry={5} fill="#f43f5e" opacity={isHappy ? 0.45 : 0.22} />
          <Ellipse cx={72} cy={63} rx={7} ry={5} fill="#f43f5e" opacity={isHappy ? 0.45 : 0.22} />

          {/* Eyes */}
          {isSad ? (
            <G stroke="#1e1b4b" strokeWidth={2.8} fill="none" strokeLinecap="round">
              <Path d="M36 54 Q40 50 44 54" />
              <Path d="M56 54 Q60 50 64 54" />
              <Path d="M37 59 Q35 64 37 67 Q39 64 37 59" fill="#7dd3fc" stroke="none" />
            </G>
          ) : (
            <G>
              <Circle cx={40} cy={54} r={5.5} fill="#ffffff" />
              <Circle cx={40} cy={54} r={3.6} fill="#312e81" />
              <Circle cx={40} cy={54} r={2.1} fill="#0f0a2a" />
              <Circle cx={41.8} cy={52.2} r={1.1} fill="#ffffff" />

              <Circle cx={60} cy={54} r={5.5} fill="#ffffff" />
              <Circle cx={60} cy={54} r={3.6} fill="#312e81" />
              <Circle cx={60} cy={54} r={2.1} fill="#0f0a2a" />
              <Circle cx={61.8} cy={52.2} r={1.1} fill="#ffffff" />
            </G>
          )}

          {/* Nose & Mouth */}
          <Ellipse cx={50} cy={62} rx={4.5} ry={3.2} fill="#e11d48" />
          <Line x1={50} y1={65} x2={50} y2={68} stroke="#9f1239" strokeWidth={1.2} strokeLinecap="round" />
          <Path
            d={mouthD}
            fill={isHappy ? '#fb7185' : 'none'}
            stroke="#7f1d1d"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          {isHappy ? <Rect x={45} y={67} width={10} height={5} rx={1.5} fill="#ffffff" /> : null}
        </Svg>
      </Animated.View>
    </Pressable>
  );
});

const ConfettiParticle = React.memo(function ConfettiParticle({
  color,
  targetX,
  targetY,
  rotateDeg,
  delayMs,
}: {
  color: string;
  targetX: number;
  targetY: number;
  rotateDeg: number;
  delayMs: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(progress);
  }, [delayMs, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: progress.value * targetX },
      { translateY: progress.value * targetY },
      { rotate: `${progress.value * rotateDeg}deg` },
      { scale: 1 - progress.value * 0.7 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        { backgroundColor: color },
        animStyle,
      ]}
    />
  );
});

const CONFETTI_SPECS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const radius = 70 + (i % 3) * 32;
  return {
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#f59e0b',
    targetX: Math.cos(angle) * radius,
    targetY: Math.sin(angle) * radius - 35,
    rotateDeg: (i % 2 === 0 ? 1 : -1) * (180 + i * 25),
    delayMs: (i % 4) * 35,
  };
});

function ConfettiBurst() {
  return (
    <View style={styles.confettiOverlay} pointerEvents="none">
      {CONFETTI_SPECS.map((p) => (
        <ConfettiParticle
          key={p.id}
          color={p.color}
          targetX={p.targetX}
          targetY={p.targetY}
          rotateDeg={p.rotateDeg}
          delayMs={p.delayMs}
        />
      ))}
    </View>
  );
}

const RealisticCart = React.memo(function RealisticCart({
  uid,
  cartItems,
  cartState,
  reduceMotion,
}: {
  uid: string;
  cartItems: readonly CartItemEntry[];
  cartState: CartVisualState;
  reduceMotion: boolean;
}) {
  const transX = useSharedValue(cartState === 'enter' ? -360 : 0);
  const transY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(transX);
    cancelAnimation(transY);
    cancelAnimation(scale);

    if (cartState === 'enter') {
      if (reduceMotion) {
        transX.value = 0;
      } else {
        transX.value = -360;
        transX.value = withTiming(0, { duration: 750, easing: Easing.out(Easing.cubic) });
      }
      transY.value = 0;
      scale.value = 1;
      return;
    }

    if (cartState === 'exit') {
      if (reduceMotion) {
        transX.value = 380;
      } else {
        transX.value = withTiming(380, { duration: 750, easing: Easing.in(Easing.cubic) });
      }
      transY.value = 0;
      scale.value = 1;
      return;
    }

    transX.value = 0;

    if (cartState === 'dragOver') {
      transY.value = 0;
      scale.value = reduceMotion ? 1.04 : withSpring(1.05);
      return;
    }

    if (cartState === 'bounce') {
      if (!reduceMotion) {
        transY.value = withSequence(
          withTiming(-7, { duration: 110 }),
          withTiming(3, { duration: 120 }),
          withTiming(0, { duration: 140 }),
        );
        scale.value = withSequence(
          withTiming(1.05, { duration: 110 }),
          withTiming(0.97, { duration: 120 }),
          withTiming(1, { duration: 140 }),
        );
      }
      return;
    }

    scale.value = reduceMotion ? 1 : withTiming(1, { duration: 180 });
    if (reduceMotion) {
      transY.value = 0;
    } else {
      transY.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [cartState, reduceMotion, scale, transX, transY]);

  const wrapperAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: transX.value },
      { translateY: transY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.cartWrapper, wrapperAnim]}>
      <View style={styles.cartGroundShadow} pointerEvents="none" />

      <View style={styles.cartFrame}>
        {/* Back basket + handle + frame */}
        <Svg
          viewBox="0 0 260 150"
          width="100%"
          height="100%"
          style={styles.cartSvgBack}
        >
          <Defs>
            <LinearGradient id={`g7Metal-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#f8fafc" />
              <Stop offset="40%" stopColor="#cbd5e1" />
              <Stop offset="80%" stopColor="#64748b" />
              <Stop offset="100%" stopColor="#334155" />
            </LinearGradient>
            <LinearGradient id={`g7Handle-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#f87171" />
              <Stop offset="50%" stopColor="#dc2626" />
              <Stop offset="100%" stopColor="#991b1b" />
            </LinearGradient>
            <Pattern id={`g7Wire-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
              <Path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.2}
                strokeOpacity={0.4}
              />
            </Pattern>
          </Defs>

          <Path
            d="M35 115 L215 115 L205 130 L45 130 Z"
            fill="none"
            stroke={`url(#g7Metal-${uid})`}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M50 85 L40 115" stroke={`url(#g7Metal-${uid})`} strokeWidth={6} strokeLinecap="round" />
          <Path d="M200 85 L210 115" stroke={`url(#g7Metal-${uid})`} strokeWidth={6} strokeLinecap="round" />

          <Path
            d="M30 32 L12 18 C8 15 5 22 8 26 L28 55"
            stroke={`url(#g7Metal-${uid})`}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
          <Rect
            x={1}
            y={8}
            width={22}
            height={14}
            rx={6}
            fill={`url(#g7Handle-${uid})`}
            transform="rotate(-28 12 18)"
          />

          <Path
            d="M30 30 L225 30 L210 95 L45 95 Z"
            fill={`url(#g7Wire-${uid})`}
            stroke="#cbd5e1"
            strokeWidth={2}
          />
          <Path
            d="M30 30 L225 30 L210 95 L45 95 Z"
            fill="#f8fafc"
            fillOpacity={0.35}
          />
        </Svg>

        {/* Middle pile layer */}
        <View style={styles.cartItemsLayer} pointerEvents="none">
          {cartItems.map((entry, idx) => {
            const col = idx % 4;
            const row = Math.floor(idx / 4);
            const leftPct = CART_COL_X[col] ?? '4%';
            const rot = CART_ROTS[col] ?? '0deg';
            const oyPx = row * -16;
            return (
              <View
                key={entry.id}
                style={[
                  styles.cartPileItem,
                  {
                    left: leftPct,
                    transform: [{ translateY: oyPx }, { rotate: rot }],
                  },
                ]}
              >
                <MarketItemVisual item={entry.item} size={26} />
              </View>
            );
          })}
        </View>

        {/* Front basket grille & wheels */}
        <Svg
          viewBox="0 0 260 150"
          width="100%"
          height="100%"
          style={styles.cartSvgFront}
        >
          <Path
            d="M30 30 L225 30 L210 95 L45 95 Z"
            fill="none"
            stroke="#64748b"
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <Line x1={33} y1={46} x2={221} y2={46} stroke="#94a3b8" strokeWidth={2.5} />
          <Line x1={37} y1={62} x2={217} y2={62} stroke="#94a3b8" strokeWidth={2.5} />
          <Line x1={41} y1={78} x2={213} y2={78} stroke="#94a3b8" strokeWidth={2.5} />

          <Line x1={60} y1={30} x2={68} y2={95} stroke="#94a3b8" strokeWidth={2} />
          <Line x1={90} y1={30} x2={95} y2={95} stroke="#94a3b8" strokeWidth={2} />
          <Line x1={120} y1={30} x2={122} y2={95} stroke="#94a3b8" strokeWidth={2} />
          <Line x1={150} y1={30} x2={149} y2={95} stroke="#94a3b8" strokeWidth={2} />
          <Line x1={180} y1={30} x2={176} y2={95} stroke="#94a3b8" strokeWidth={2} />
          <Line x1={205} y1={30} x2={198} y2={95} stroke="#94a3b8" strokeWidth={2} />

          <Rect x={23} y={26} width={12} height={10} rx={3} fill="#dc2626" />
          <Rect x={220} y={26} width={12} height={10} rx={3} fill="#dc2626" />

          <Path
            d="M32 32 L55 32 L50 65 L35 65 Z"
            fill="#ef4444"
            fillOpacity={0.85}
            stroke="#b91c1c"
            strokeWidth={1.5}
          />

          <G transform="translate(42, 128)">
            <Circle cx={0} cy={0} r={13} fill="#1e293b" />
            <Circle cx={0} cy={0} r={8} fill="#94a3b8" />
            <Circle cx={0} cy={0} r={4} fill="#f8fafc" />
            <Path d="M-3 -12 L3 -12 L2 -18 L-2 -18 Z" fill="#64748b" />
          </G>
          <G transform="translate(208, 128)">
            <Circle cx={0} cy={0} r={13} fill="#1e293b" />
            <Circle cx={0} cy={0} r={8} fill="#94a3b8" />
            <Circle cx={0} cy={0} r={4} fill="#f8fafc" />
            <Path d="M-3 -12 L3 -12 L2 -18 L-2 -18 Z" fill="#64748b" />
          </G>
        </Svg>
      </View>
    </Animated.View>
  );
});

function FlyingItemOverlay({
  entry,
  onLand,
}: {
  entry: FlyingItemEntry;
  onLand: (id: string, item: MobileMarketItem) => void;
}) {
  const t = useSharedValue(0);
  const onLandRef = useRef(onLand);
  useEffect(() => {
    onLandRef.current = onLand;
  }, [onLand]);

  const midX = (entry.fromX + entry.toX) / 2;
  const peakY = Math.min(entry.fromY, entry.toY) - 48;

  useEffect(() => {
    t.value = withTiming(
      1,
      { duration: 520, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          scheduleOnRN(onLandRef.current, entry.id, entry.item);
        }
      },
    );
    return () => cancelAnimation(t);
  }, [entry.id, entry.item, t]);

  const animStyle = useAnimatedStyle(() => {
    const u = t.value;
    const inv = 1 - u;
    const x = inv * inv * entry.fromX + 2 * inv * u * midX + u * u * entry.toX;
    const y = inv * inv * entry.fromY + 2 * inv * u * peakY + u * u * entry.toY;
    const s = 1.15 - u * 0.3;
    const rot = -10 + u * 16;
    return {
      transform: [
        { translateX: x - 20 },
        { translateY: y - 20 },
        { scale: s },
        { rotate: `${rot}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.flyingItem, animStyle]} pointerEvents="none">
      <MarketItemVisual item={entry.item} size={36} />
    </Animated.View>
  );
}

interface ShelfTileProps {
  item: MobileMarketItem;
  isDragging: boolean;
  onTapItem: (item: MobileMarketItem, ref: React.RefObject<RNViewRef | null>) => void;
  onDragBegin: (item: MobileMarketItem, absX: number, absY: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: (item: MobileMarketItem, absX: number, absY: number) => void;
}

const ShelfTile = React.memo(function ShelfTile({
  item,
  isDragging,
  onTapItem,
  onDragBegin,
  onDragMove,
  onDragEnd,
}: ShelfTileProps) {
  const tileRef = useRef<RNViewRef | null>(null);

  const pan = Gesture.Pan()
    .minDistance(10)
    .onStart((e) => {
      'worklet';
      scheduleOnRN(onDragBegin, item, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      scheduleOnRN(onDragMove, e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      scheduleOnRN(onDragEnd, item, e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      'worklet';
      scheduleOnRN(onDragEnd, item, -1, -1);
    });

  return (
    <View ref={tileRef} style={[styles.shelfTileWrap, isDragging && styles.shelfTileGhost]}>
      <GestureDetector gesture={pan}>
        <Pressable
          onPress={() => onTapItem(item, tileRef)}
          accessibilityRole="button"
          accessibilityLabel={item.ptName}
          style={({ pressed }) => [
            styles.marketItem,
            pressed && styles.marketItemPressed,
          ]}
        >
          <View
            style={[
              styles.marketItemIconWrap,
              item.iconBg ? { backgroundColor: item.iconBg } : null,
            ]}
          >
            <MarketItemVisual item={item} size={34} />
          </View>
          <View style={styles.marketItemTag}>
            <Text
              style={styles.marketItemTagText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              maxFontSizeMultiplier={1.2}
            >
              {item.ptName}
            </Text>
          </View>
        </Pressable>
      </GestureDetector>
    </View>
  );
});

export function Game7({
  language,
  onScore,
  score = 0,
  recentGain = null,
  gainKey = 0,
  onInteractionLockChange,
}: Game7Props) {
  const isTr = language === 'tr';
  const reduceMotion = useReducedMotion();

  const [initialRound] = useState(() => buildRound([]));

  const recentItemsRef = useRef<string[]>(initialRound.nextRecent);
  const [availableItems, setAvailableItems] = useState<MobileMarketItem[]>(
    () => initialRound.shelf,
  );
  const [order, setOrder] = useState<{ item: MobileMarketItem; count: number }>(() => ({
    item: initialRound.target,
    count: initialRound.count,
  }));
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState<CartItemEntry[]>([]);
  const [cartState, setCartState] = useState<CartVisualState>('idle');
  const [cartKey, setCartKey] = useState(0);
  const [exitingCart, setExitingCart] = useState<CartItemEntry[] | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [speechText, setSpeechText] = useState(() =>
    buildMarketOrderText(initialRound.count, initialRound.target),
  );
  const [flyingItems, setFlyingItems] = useState<FlyingItemEntry[]>([]);
  const [draggingItem, setDraggingItem] = useState<MobileMarketItem | null>(null);

  const rootRef = useRef<RNViewRef | null>(null);
  const cartZoneRef = useRef<RNViewRef | null>(null);
  const rootBoxRef = useRef<RectBox>({ x: 0, y: 0, width: 360, height: 600 });
  const cartBoxRef = useRef<RectBox>({ x: 0, y: 0, width: 0, height: 0 });
  const cartItemsRef = useRef<CartItemEntry[]>([]);
  const wrongDropsRef = useRef(0);
  const inFlightCountRef = useRef(0);
  const pendingCountRef = useRef(0);
  const isSuccessRef = useRef(false);
  const cartStateRef = useRef<CartVisualState>('idle');
  const cartCountRef = useRef(0);
  const orderRef = useRef(order);
  const speechTextRef = useRef(speechText);
  const langRef = useRef(language);
  const onScoreRef = useRef(onScore);
  const lockChangeRef = useRef(onInteractionLockChange);
  const wasDraggingRef = useRef(false);
  const dragHandledEndRef = useRef(false);
  const countSpeechActiveRef = useRef(false);
  const announceGenerationRef = useRef(0);
  const queuedOrderAnnounceRef = useRef<(() => void) | null>(null);
  const flushOrderAnnounceRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const dragGhostX = useSharedValue(0);
  const dragGhostY = useSharedValue(0);

  useEffect(() => {
    langRef.current = language;
  }, [language]);
  useEffect(() => {
    onScoreRef.current = onScore;
  }, [onScore]);
  useEffect(() => {
    lockChangeRef.current = onInteractionLockChange;
  }, [onInteractionLockChange]);
  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);
  useEffect(() => {
    isSuccessRef.current = isSuccess;
  }, [isSuccess]);
  useEffect(() => {
    cartStateRef.current = cartState;
  }, [cartState]);
  useEffect(() => {
    cartCountRef.current = cartCount;
  }, [cartCount]);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const announceOrder = useCallback((delayMs = 0) => {
    announceGenerationRef.current += 1;
    const gen = announceGenerationRef.current;

    const speakCurrentOrder = () => {
      const phrase = speechTextRef.current.replace('!', '');
      if (!phrase) return;
      queuedOrderAnnounceRef.current = null;
      flushOrderAnnounceRef.current = null;
      speakText(phrase, { language: langRef.current });
    };

    if (delayMs > 0) {
      let minDelayElapsed = false;
      const tryFlush = () => {
        if (gen !== announceGenerationRef.current) return;
        if (!minDelayElapsed || countSpeechActiveRef.current) return;
        const fn = queuedOrderAnnounceRef.current;
        if (fn) {
          queuedOrderAnnounceRef.current = null;
          flushOrderAnnounceRef.current = null;
          fn();
        }
      };
      queuedOrderAnnounceRef.current = speakCurrentOrder;
      flushOrderAnnounceRef.current = tryFlush;
      scheduleTimer(() => {
        if (gen !== announceGenerationRef.current) return;
        minDelayElapsed = true;
        tryFlush();
      }, delayMs);
      // Safety cap so next order always announces even if TTS never fires onDone
      scheduleTimer(() => {
        if (gen !== announceGenerationRef.current) return;
        countSpeechActiveRef.current = false;
        flushOrderAnnounceRef.current = null;
        const fn = queuedOrderAnnounceRef.current;
        if (fn) {
          queuedOrderAnnounceRef.current = null;
          fn();
        }
      }, delayMs + 1650);
    } else {
      countSpeechActiveRef.current = false;
      queuedOrderAnnounceRef.current = null;
      flushOrderAnnounceRef.current = null;
      speakCurrentOrder();
    }
  }, [scheduleTimer]);

  const speakCountPhrase = useCallback(
    (count: number, item: MobileMarketItem) => {
      countSpeechActiveRef.current = true;
      speakText(buildMarketCountSpeech(count, item), {
        language: langRef.current,
        onDone: () => {
          countSpeechActiveRef.current = false;
          flushOrderAnnounceRef.current?.();
        },
      });
    },
    [],
  );

  const measureBoxes = useCallback(() => {
    rootRef.current?.measureInWindow((rx, ry, rw, rh) => {
      if (rw > 0 && rh > 0) {
        rootBoxRef.current = { x: rx, y: ry, width: rw, height: rh };
      }
    });
    cartZoneRef.current?.measureInWindow((cx, cy, cw, ch) => {
      if (cw > 0 && ch > 0) {
        cartBoxRef.current = { x: cx, y: cy, width: cw, height: ch };
      }
    });
  }, []);

  // Announce initial order on mount
  useEffect(() => {
    const timers = timersRef.current;
    speechTextRef.current = speechText;
    announceOrder(250);
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      queuedOrderAnnounceRef.current = null;
      flushOrderAnnounceRef.current = null;
      countSpeechActiveRef.current = false;
      lockChangeRef.current?.(false);
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewRound = useCallback(
    (clearCart = false, keepCartState = false, keepMascotState = false) => {
      const next = buildRound(recentItemsRef.current);
      recentItemsRef.current = next.nextRecent;

      setAvailableItems(next.shelf);
      const nextOrder = { item: next.target, count: next.count };
      orderRef.current = nextOrder;
      setOrder(nextOrder);

      cartCountRef.current = 0;
      setCartCount(0);
      isSuccessRef.current = false;
      setIsSuccess(false);
      wrongDropsRef.current = 0;
      pendingCountRef.current = 0;

      if (!keepCartState) {
        cartStateRef.current = 'idle';
        setCartState('idle');
      }
      if (!keepMascotState) {
        setMascotState('idle');
      }
      if (clearCart) {
        cartItemsRef.current = [];
        setCartItems([]);
      }

      const nextPhrase = buildMarketOrderText(next.count, next.target);
      speechTextRef.current = nextPhrase;
      setSpeechText(nextPhrase);
    },
    [],
  );

  const handleMascotPress = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setMascotState('talking');
    announceOrder(0);
    scheduleTimer(() => setMascotState('idle'), 2000);
  }, [announceOrder, scheduleTimer]);

  const handleItemDrop = useCallback(
    (dropped: MobileMarketItem, speakCount = false) => {
      const currentOrder = orderRef.current;
      if (isSuccessRef.current) return;
      if (cartStateRef.current === 'enter') return;
      if (cartCountRef.current >= currentOrder.count) return;

      if (dropped.id === currentOrder.item.id) {
        const newCount = cartCountRef.current + 1;
        cartCountRef.current = newCount;
        setCartCount(newCount);

        if (speakCount) {
          pendingCountRef.current += 1;
          speakCountPhrase(pendingCountRef.current, dropped);
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const entryId = `${Date.now()}-${Math.random()}`;
        const nextCart = [...cartItemsRef.current, { id: entryId, item: dropped }];
        cartItemsRef.current = nextCart;
        setCartItems(nextCart);

        cartStateRef.current = 'bounce';
        setCartState('bounce');
        scheduleTimer(() => {
          if (cartStateRef.current === 'bounce') {
            cartStateRef.current = 'idle';
            setCartState('idle');
          }
        }, 420);

        if (newCount >= currentOrder.count) {
          isSuccessRef.current = true;
          setIsSuccess(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          const pts = scoreGame7(wrongDropsRef.current);
          onScoreRef.current?.(pts);

          const itemsAfterDrop = nextCart.length;
          scheduleTimer(() => {
            const cartFull = itemsAfterDrop >= CART_CAPACITY;
            if (cartFull) {
              setMascotState('happy');
              scheduleTimer(() => setMascotState('idle'), 1600);
              if (!reduceMotion) {
                setShowConfetti(true);
                scheduleTimer(() => setShowConfetti(false), 1250);
              }
              setExitingCart(nextCart);
              scheduleTimer(() => setExitingCart(null), 850);
              setCartKey((k) => k + 1);
              cartStateRef.current = 'enter';
              setCartState('enter');
              startNewRound(true, true, true);
              scheduleTimer(() => {
                cartStateRef.current = 'idle';
                setCartState('idle');
              }, 800);
            } else {
              setMascotState('talking');
              scheduleTimer(() => setMascotState('idle'), 600);
              startNewRound(false, false, true);
            }
          }, 650);

          announceOrder(itemsAfterDrop >= CART_CAPACITY ? 2100 : 1150);
        }
      } else {
        wrongDropsRef.current += 1;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setMascotState('sad');
        countSpeechActiveRef.current = false;
        speakText(`Não! Isso é ${dropped.ptName}.`, { language: langRef.current });
        scheduleTimer(() => setMascotState('idle'), 1700);
      }
    },
    [announceOrder, reduceMotion, scheduleTimer, speakCountPhrase, startNewRound],
  );

  const handleFlyLand = useCallback(
    (flyId: string, item: MobileMarketItem) => {
      inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
      setFlyingItems((prev) => prev.filter((f) => f.id !== flyId));
      handleItemDrop(item, false);
    },
    [handleItemDrop],
  );

  const handleTapItem = useCallback(
    (item: MobileMarketItem, tileRef: React.RefObject<RNViewRef | null>) => {
      if (wasDraggingRef.current) {
        wasDraggingRef.current = false;
        return;
      }
      if (isSuccessRef.current || cartStateRef.current === 'enter') return;
      const currentOrder = orderRef.current;
      const isCorrectItem = item.id === currentOrder.item.id;
      if (
        isCorrectItem &&
        cartCountRef.current + inFlightCountRef.current >= currentOrder.count
      ) {
        return;
      }

      const targetSlotIndex = cartItemsRef.current.length + inFlightCountRef.current;
      if (isCorrectItem) {
        pendingCountRef.current += 1;
        speakCountPhrase(pendingCountRef.current, item);
      }

      // Skip flight animation when reduced motion is enabled or views aren't measurable (e.g. Jest)
      if (
        reduceMotion ||
        !rootRef.current?.measureInWindow ||
        !cartZoneRef.current?.measureInWindow ||
        !tileRef.current?.measureInWindow
      ) {
        handleItemDrop(item, false);
        return;
      }

      // Reserve slot synchronously before async measureInWindow callbacks so rapid double-taps
      // cannot bypass the order count cap or collide on the same basket slot.
      inFlightCountRef.current += 1;

      rootRef.current.measureInWindow((rx, ry) => {
        cartZoneRef.current?.measureInWindow((cx, cy, cw, ch) => {
          tileRef.current?.measureInWindow((tx, ty, tw, th) => {
            if (cw <= 0 || ch <= 0 || tw <= 0 || th <= 0) {
              inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
              handleItemDrop(item, false);
              return;
            }
            const fromX = tx + tw / 2 - rx;
            const fromY = ty + th / 2 - ry;
            const col = targetSlotIndex % 4;
            const row = Math.floor(targetSlotIndex / 4);
            const colPct = CART_COL_PCT[col] ?? 0.04;
            const cartLeft = cx - rx + (cw - CART_FRAME_W) / 2;
            const cartTop = cy - ry + (ch - CART_FRAME_H) / 2;
            const toX = cartLeft + CART_FRAME_W * 0.23 + CART_FRAME_W * 0.57 * colPct + 14;
            const toY = cartTop + CART_FRAME_H * 0.62 - 16 - row * 16;
            const flyId = `${Date.now()}-${Math.random()}`;
            setFlyingItems((prev) => [
              ...prev,
              { id: flyId, item, fromX, fromY, toX, toY },
            ]);
          });
        });
      });
    },
    [handleItemDrop, reduceMotion, speakCountPhrase],
  );

  const handleDragBegin = useCallback(
    (item: MobileMarketItem, absX: number, absY: number) => {
      if (isSuccessRef.current || cartStateRef.current === 'enter') return;
      wasDraggingRef.current = true;
      dragHandledEndRef.current = false;
      lockChangeRef.current?.(true);
      setDraggingItem(item);

      // Position immediately from latest known layout box before async measureInWindow refines scroll offset
      dragGhostX.set(absX - rootBoxRef.current.x);
      dragGhostY.set(absY - rootBoxRef.current.y);

      rootRef.current?.measureInWindow((rx, ry, rw, rh) => {
        rootBoxRef.current = { x: rx, y: ry, width: rw, height: rh };
        dragGhostX.set(absX - rx);
        dragGhostY.set(absY - ry);
      });
      cartZoneRef.current?.measureInWindow((cx, cy, cw, ch) => {
        cartBoxRef.current = { x: cx, y: cy, width: cw, height: ch };
      });
      if (cartStateRef.current === 'idle') {
        cartStateRef.current = 'dragOver';
        setCartState('dragOver');
      }
    },
    [dragGhostX, dragGhostY],
  );

  const handleDragMove = useCallback(
    (absX: number, absY: number) => {
      const rootBox = rootBoxRef.current;
      dragGhostX.set(absX - rootBox.x);
      dragGhostY.set(absY - rootBox.y);
    },
    [dragGhostX, dragGhostY],
  );

  const handleDragEnd = useCallback(
    (item: MobileMarketItem, absX: number, absY: number) => {
      if (dragHandledEndRef.current) return;
      dragHandledEndRef.current = true;
      lockChangeRef.current?.(false);
      setDraggingItem(null);
      scheduleTimer(() => {
        wasDraggingRef.current = false;
      }, 120);

      if (cartStateRef.current === 'dragOver') {
        cartStateRef.current = 'idle';
        setCartState('idle');
      }

      if (absX < 0 || absY < 0 || isSuccessRef.current) return;
      const b = cartBoxRef.current;
      const overCart =
        b.width > 0 &&
        absX >= b.x - 36 &&
        absX <= b.x + b.width + 36 &&
        absY >= b.y - 44 &&
        absY <= b.y + b.height + 44;

      if (overCart) {
        handleItemDrop(item, true);
      }
    },
    [handleItemDrop, scheduleTimer],
  );

  const dragGhostStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragGhostX.value - 28 },
      { translateY: dragGhostY.value - 28 },
      { scale: 1.28 },
      { rotate: '8deg' },
    ],
  }));

  const listenLabel = isTr ? 'Dinle' : 'Ouvir';
  const orderDone = cartCount >= order.count;

  return (
    <View ref={rootRef} style={styles.card} onLayout={measureBoxes}>
      <GameScoreBadge score={score} recentGain={recentGain} gainKey={gainKey} />

      {/* Mascot + Speech Bubble */}
      <View style={styles.mascotRow}>
        <BunnyMascot
          state={mascotState}
          language={language}
          onPress={handleMascotPress}
        />

        <View style={styles.speechCard}>
          <Text style={styles.speechText} maxFontSizeMultiplier={1.25}>
            {speechText}
          </Text>
          <Pressable
            onPress={handleMascotPress}
            accessibilityRole="button"
            accessibilityLabel={listenLabel}
            hitSlop={8}
            style={({ pressed }) => [styles.ouvirBtn, pressed && styles.pressedSoft]}
          >
            <Volume2 size={18} strokeWidth={2.4} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {/* Progress Pill */}
      <View style={styles.progressBadge}>
        <MarketItemVisual item={order.item} size={22} />
        <Text style={styles.progressFraction} maxFontSizeMultiplier={1.2}>
          {cartCount} / {order.count}
        </Text>
        {orderDone ? (
          <View style={styles.progressCheck}>
            <Text style={styles.progressCheckText}>✓</Text>
          </View>
        ) : null}
      </View>

      {/* Cart Stage */}
      <View ref={cartZoneRef} style={styles.cartZone} onLayout={measureBoxes}>
        {exitingCart !== null ? (
          <View style={styles.exitingCartLayer} pointerEvents="none">
            <RealisticCart
              uid="exit"
              cartItems={exitingCart}
              cartState="exit"
              reduceMotion={reduceMotion}
            />
          </View>
        ) : null}

        <RealisticCart
          key={cartKey}
          uid="active"
          cartItems={cartItems}
          cartState={flyingItems.length > 0 && cartState === 'idle' ? 'dragOver' : cartState}
          reduceMotion={reduceMotion}
        />
      </View>

      {/* Unclipped confetti burst rendered above cartZone */}
      {showConfetti ? (
        <View style={styles.confettiStageOverlay} pointerEvents="none">
          <ConfettiBurst />
        </View>
      ) : null}

      {/* Wooden Shelf */}
      <View style={styles.marketShelf}>
        <Text style={styles.marketShelfLabel} maxFontSizeMultiplier={1.2}>
          🏪 {isTr ? 'PAZAR TEZGAHI' : 'BANCADA DO MERCADO'}
        </Text>
        <View style={styles.shelfPlank}>
          <View style={styles.shelfGrid}>
            {availableItems.map((item) => (
              <ShelfTile
                key={item.id}
                item={item}
                isDragging={draggingItem?.id === item.id}
                onTapItem={handleTapItem}
                onDragBegin={handleDragBegin}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Flying Items Overlay */}
      {flyingItems.map((entry) => (
        <FlyingItemOverlay key={entry.id} entry={entry} onLand={handleFlyLand} />
      ))}

      {/* Active Drag Ghost Overlay */}
      {draggingItem ? (
        <Animated.View style={[styles.dragGhost, dragGhostStyle]} pointerEvents="none">
          <MarketItemVisual item={draggingItem} size={42} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 3.5,
    borderColor: colors.sky,
    padding: 12,
    gap: 8,
    position: 'relative',
    ...shadows.md,
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 58,
  },
  bunnyWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  bunnyStars: {
    position: 'absolute',
    top: -12,
    fontSize: 13,
    zIndex: 20,
  },
  speechCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: '#fbbf24',
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...shadows.sm,
  },
  speechText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '900',
    color: '#451a03',
    lineHeight: 20,
  },
  ouvirBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  progressBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 2,
    borderColor: colors.amber,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    ...shadows.sm,
  },
  progressFraction: {
    fontSize: 15,
    fontWeight: '900',
    color: '#451a03',
  },
  progressCheck: {
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCheckText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  cartZone: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 152,
    overflow: 'hidden',
  },
  exitingCartLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cartWrapper: {
    position: 'relative',
    alignItems: 'center',
    width: 256,
  },
  cartGroundShadow: {
    position: 'absolute',
    bottom: 2,
    width: 206,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 99,
  },
  cartFrame: {
    position: 'relative',
    width: '100%',
    height: 146,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSvgBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  cartSvgFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
  },
  cartItemsLayer: {
    position: 'absolute',
    top: 0,
    left: '23%',
    width: '57%',
    height: '62%',
    zIndex: 1,
    overflow: 'visible',
  },
  cartPileItem: {
    position: 'absolute',
    bottom: 2,
  },
  confettiStageOverlay: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 35,
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 6,
    borderRadius: 2,
  },
  marketShelf: {
    backgroundColor: '#713f12',
    borderTopWidth: 5,
    borderTopColor: '#a16207',
    borderBottomWidth: 7,
    borderBottomColor: '#3b1f07',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#7c3a0a',
    borderRadius: radii.xl,
    padding: 8,
    ...shadows.md,
  },
  marketShelfLabel: {
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 12,
    color: '#fde68a',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  shelfPlank: {
    backgroundColor: '#542d0c',
    borderRadius: radii.lg,
    padding: 6,
  },
  shelfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  shelfTileWrap: {
    width: '24%',
  },
  shelfTileGhost: {
    opacity: 0.25,
  },
  marketItem: {
    minHeight: Math.max(touchTargets.min, 72),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 4,
    borderRadius: radii.md,
  },
  marketItemPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  marketItemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketItemTag: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: 'rgba(120, 53, 15, 0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  marketItemTagText: {
    color: '#451a03',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  flyingItem: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 70,
  },
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 80,
  },
  pressedSoft: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
