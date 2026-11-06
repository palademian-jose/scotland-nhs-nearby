// All text and control colours are checked against WCAG AA in __tests__/theme.test.ts.
export const colors = {
  background: '#F0F4F5',
  surface: '#FFFFFF',
  text: '#212B32',
  textMuted: '#4C6272',
  primary: '#005EB8',
  onPrimary: '#FFFFFF',
  border: '#768692',
  danger: '#B3261E',
  warningBg: '#FFF1C2',
  warningText: '#5C4400',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Minimum touch target on iOS and Android guidelines.
export const MIN_TARGET = 44;

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
