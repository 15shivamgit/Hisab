import { colors, type ColorScheme, type ColorTokens } from '@/theme/tokens';

// WCAG 2.1 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Text-bearing pairs that must reach 4.5:1 in both themes (NFR-09).
const textPairs: [keyof ColorTokens, keyof ColorTokens][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surfaceAlt'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['primary', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['income', 'surface'],
  ['willGet', 'surface'],
  ['owe', 'surface'],
  ['settled', 'surface'],
  ['warning', 'surface'],
  ['danger', 'surface'],
  ['onDanger', 'danger'],
];

describe.each<ColorScheme>(['light', 'dark'])('%s theme contrast', (scheme) => {
  test.each(textPairs)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(colors[scheme][fg], colors[scheme][bg])).toBeGreaterThanOrEqual(4.5);
  });
});

test('both themes define the same tokens', () => {
  expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
});
