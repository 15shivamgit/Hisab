// Design tokens — the single source for colours, spacing, radius, and type.
// Spec: docs/06-design/DESIGN_TOKENS.md. Components use these only; no hard-coded values.

import type { TextStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  income: string;
  expense: string;
  willGet: string;
  owe: string;
  settled: string;
  warning: string;
  danger: string;
  onDanger: string;
  focus: string;
}

const light: ColorTokens = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#475569',
  primary: '#0369A1',
  primarySoft: '#E0F2FE',
  onPrimary: '#FFFFFF',
  income: '#15803D',
  expense: '#0F172A',
  willGet: '#15803D',
  owe: '#C2410C',
  settled: '#64748B',
  warning: '#B45309',
  danger: '#B91C1C',
  onDanger: '#FFFFFF',
  focus: '#2563EB',
};

const dark: ColorTokens = {
  bg: '#0B1220',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  border: '#334155',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  primary: '#38BDF8',
  primarySoft: '#082F49',
  onPrimary: '#082F49',
  income: '#4ADE80',
  expense: '#F1F5F9',
  willGet: '#4ADE80',
  owe: '#FB923C',
  settled: '#94A3B8',
  warning: '#FBBF24',
  danger: '#F87171',
  onDanger: '#450A0A',
  focus: '#60A5FA',
};

export const colors: Record<ColorScheme, ColorTokens> = { light, dark };

export const categoryColors = {
  'cat.red': '#DC2626',
  'cat.orange': '#EA580C',
  'cat.amber': '#D97706',
  'cat.green': '#16A34A',
  'cat.teal': '#0D9488',
  'cat.blue': '#2563EB',
  'cat.indigo': '#4F46E5',
  'cat.purple': '#9333EA',
  'cat.pink': '#DB2777',
  'cat.slate': '#475569',
} as const;

export type CategoryColorToken = keyof typeof categoryColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

/** Minimum touch target (NFR-09). */
export const minTouchTarget = 48;

type TypeToken = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight'>;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
} as const satisfies Record<string, TypeToken>;

export type TypographyVariant = keyof typeof typography;
