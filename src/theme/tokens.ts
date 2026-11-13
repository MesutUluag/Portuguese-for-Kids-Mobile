import { Platform } from 'react-native';

/**
 * Design tokens ported from Portugese-for-Kids/src/styles/_variables.scss
 * plus mobile kid-friendly accessibility sizing rules.
 */
export const colors = {
  bg: '#fef9c3',
  white: '#ffffff',
  textDark: '#1e293b',
  textMuted: '#64748b',
  navy: '#1e3a8a',

  amber: '#f59e0b',
  amberLight: '#fde047',
  amberPale: '#fef08a',
  green: '#10b981',
  greenLight: '#a7f3d0',
  pink: '#ec4899',
  pinkLight: '#fbcfe8',
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  purpleLight: '#ddd6fe',
  blue: '#3b82f6',
  blueLight: '#bfdbfe',
  orange: '#f97316',
  orangeLight: '#fed7aa',
  cyan: '#06b6d4',
  cyanLight: '#a5f3fc',

  sky: '#0284c7',
  skyDark: '#0369a1',
  red: '#ef4444',
  rose: '#f43f5e',
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Minimum interactive hit target (pt/dp) for ages 7+ */
export const touchTargets = {
  min: 56,
  nav: 48,
} as const;

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
    },
    android: { elevation: 3 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: { elevation: 5 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;
