import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, getTheme, themeVariables } from '../content/themes';

/** Relative luminance, per WCAG. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return NaN;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('palettes', () => {
  it('offers both darker and brighter choices', () => {
    expect(THEMES.filter((t) => t.mode === 'night').length).toBeGreaterThanOrEqual(2);
    expect(THEMES.filter((t) => t.mode === 'day').length).toBeGreaterThanOrEqual(2);
  });

  it('has unique ids and a valid default', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(getTheme(DEFAULT_THEME).id).toBe(DEFAULT_THEME);
  });

  it('falls back rather than rendering an unstyled app', () => {
    expect(getTheme('does-not-exist').id).toBe(DEFAULT_THEME);
  });

  it('keeps body text readable on the page background', () => {
    // A cheerful pastel a child cannot read is not cheerful.
    for (const theme of THEMES) {
      const ratio = contrast(theme.tokens.textHi, theme.tokens.ink900);
      expect(ratio, `${theme.id} body text`).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps button text readable on the accent', () => {
    for (const theme of THEMES) {
      const ratio = contrast(theme.tokens.onAccent, theme.tokens.accent);
      expect(ratio, `${theme.id} on-accent`).toBeGreaterThanOrEqual(3);
    }
  });

  it('matches night palettes to dark surfaces and day palettes to light ones', () => {
    for (const theme of THEMES) {
      const bg = luminance(theme.tokens.ink900);
      if (theme.mode === 'night') expect(bg, `${theme.id}`).toBeLessThan(0.1);
      else expect(bg, `${theme.id}`).toBeGreaterThan(0.6);
    }
  });

  it('never uses pure black', () => {
    for (const theme of THEMES) {
      expect(theme.tokens.ink900.toLowerCase(), theme.id).not.toBe('#000000');
    }
  });

  it('maps onto the token names the stylesheet already uses', () => {
    const vars = themeVariables(THEMES[0]);
    // If a name here drifts from tokens.css, the palette silently stops applying.
    for (const name of [
      '--ink-900', '--ink-800', '--ink-700', '--ink-600',
      '--amber-400', '--amber-300', '--amber-500', '--on-accent',
      '--rose-400', '--violet-400', '--mint-400',
      '--text-hi', '--text-mid', '--text-low',
      '--glass-bg', '--glass-bg-strong', '--glass-border', '--glass-highlight',
      '--clay-shadow',
    ]) {
      expect(vars[name], name).toBeTruthy();
    }
  });

  it('gives every palette a name, emoji and one-line blurb', () => {
    for (const theme of THEMES) {
      expect(theme.name.length, theme.id).toBeGreaterThan(2);
      expect(theme.emoji.length, theme.id).toBeGreaterThan(0);
      expect(theme.blurb.length, theme.id).toBeGreaterThan(15);
    }
  });
});
