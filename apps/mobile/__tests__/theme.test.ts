import { colors, contrastRatio, MIN_TARGET } from '../src/theme';

describe('theme contrast (WCAG AA, 4.5:1 for text)', () => {
  const pairs: [string, string, string][] = [
    ['text on background', colors.text, colors.background],
    ['text on surface', colors.text, colors.surface],
    ['muted text on surface', colors.textMuted, colors.surface],
    ['muted text on background', colors.textMuted, colors.background],
    ['primary on surface', colors.primary, colors.surface],
    ['primary on background', colors.primary, colors.background],
    ['button text on primary', colors.onPrimary, colors.primary],
    ['error on surface', colors.danger, colors.surface],
    ['error on background', colors.danger, colors.background],
    ['warning text on warning', colors.warningText, colors.warningBg],
    ['badge text on warning text', colors.onPrimary, colors.warningText],
  ];

  it.each(pairs)('%s', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('input borders reach the 3:1 non-text minimum', () => {
    expect(contrastRatio(colors.border, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it('computes the known black/white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('keeps touch targets at 44 points', () => {
    expect(MIN_TARGET).toBe(44);
  });
});
