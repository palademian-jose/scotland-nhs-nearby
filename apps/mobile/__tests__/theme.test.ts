import { contrastRatio, darkPalette, lightPalette, MIN_TARGET, type Palette } from '../src/theme';

const palettes: [string, Palette][] = [
  ['light', lightPalette],
  ['dark', darkPalette],
];

describe.each(palettes)('%s theme contrast (WCAG AA)', (_scheme, c) => {
  const text: [string, string, string][] = [
    ['text on background', c.text, c.background],
    ['text on surface', c.text, c.surface],
    ['text on muted surface', c.text, c.surfaceMuted],
    ['secondary text on background', c.textSecondary, c.background],
    ['secondary text on surface', c.textSecondary, c.surface],
    ['secondary text on muted surface', c.textSecondary, c.surfaceMuted],
    ['tertiary text on background', c.textTertiary, c.background],
    ['tertiary text on surface', c.textTertiary, c.surface],
    ['tertiary text on muted surface', c.textTertiary, c.surfaceMuted],
    ['accent on surface', c.accent, c.surface],
    ['accent on background', c.accent, c.background],
    ['accent on soft accent', c.accent, c.accentSoft],
    ['accent on muted surface', c.accent, c.surfaceMuted],
    ['button text on accent', c.onAccent, c.accent],
    ['error on surface', c.danger, c.surface],
    ['error on background', c.danger, c.background],
    ['warning text on warning', c.warningText, c.warningBg],
  ];

  it.each(text)('%s reaches 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  const components: [string, string, string][] = [
    ['input outline on surface', c.borderStrong, c.surface],
    ['input outline on background', c.borderStrong, c.background],
    ['accent icon on soft accent', c.accent, c.accentSoft],
    ['accent control on surface', c.accent, c.surface],
    ['accent control on background', c.accent, c.background],
  ];

  it.each(components)('%s reaches 3:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('theme helpers', () => {
  it('computes the known black/white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('keeps touch targets at 44 points', () => {
    expect(MIN_TARGET).toBe(44);
  });
});
