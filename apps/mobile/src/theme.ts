import { useMemo } from 'react';
import { Platform, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';

// Every text, icon and control pair below is checked against WCAG AA in __tests__/theme.test.ts.
export interface Palette {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Hairlines and card outlines. Decorative, so it is not held to 3:1. */
  border: string;
  /** Outline of text inputs, which must reach 3:1 against the surface. */
  borderStrong: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  warningBg: string;
  warningText: string;
}

export const lightPalette: Palette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F6',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#5B6B82',
  border: '#E2E8F0',
  borderStrong: '#7C8BA0',
  accent: '#0F766E',
  accentSoft: '#CCFBF1',
  onAccent: '#FFFFFF',
  danger: '#B91C1C',
  warningBg: '#FEF3C7',
  warningText: '#78350F',
};

export const darkPalette: Palette = {
  background: '#0B0F14',
  surface: '#151A21',
  surfaceMuted: '#1C232C',
  text: '#F1F5F9',
  textSecondary: '#A3B0C2',
  textTertiary: '#8696AC',
  border: '#273040',
  borderStrong: '#5B6B82',
  accent: '#2DD4BF',
  accentSoft: '#134E4A',
  onAccent: '#042F2E',
  danger: '#F87171',
  warningBg: '#3A2E0A',
  warningText: '#FDE68A',
};

export const radii = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

// Minimum touch target on iOS and Android guidelines.
export const MIN_TARGET = 44;

const fontFamily = Platform.select({
  web: '-apple-system, "Segoe UI", Inter, Roboto, sans-serif',
  default: undefined,
});

export const typography = {
  display: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  title: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '400' },
  caption: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

/** The one soft elevation used for cards and floating controls. */
export const cardShadow: ViewStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
  radii: typeof radii;
  spacing: typeof spacing;
  type: typeof typography;
  shadow: ViewStyle;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkPalette : lightPalette,
      radii,
      spacing,
      type: typography,
      shadow: cardShadow,
    }),
    [scheme],
  );
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
