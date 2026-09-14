/**
 * Colour palettes.
 *
 * The app was a single warm-amber night theme. Children want colour and choice,
 * so this is a set of full token overrides applied at the document root.
 *
 * Two things stay true whichever palette is chosen:
 *  - The **sleep gradient still warms and dims on top**. A bright daytime
 *    palette does not defeat the wind-down; it gets dimmed like everything else.
 *  - Contrast is checked per palette, because a cheerful pastel that a child
 *    cannot read is not cheerful.
 *
 * Token names match `styles/tokens.css` exactly, so no component CSS changes
 * when a palette is swapped — the defaults in that file are Midnight.
 */

export type ThemeMode = 'night' | 'day';

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  mode: ThemeMode;
  /** One line for the parent choosing. */
  blurb: string;
  tokens: {
    /** Page background, then progressively raised surfaces. */
    ink900: string;
    ink800: string;
    ink700: string;
    ink600: string;
    /** Primary action colour, plus a lighter and deeper step. */
    accent: string;
    accentSoft: string;
    accentStrong: string;
    /** Text that sits ON the accent — must contrast with it, not with the page. */
    onAccent: string;
    pop1: string;
    pop2: string;
    pop3: string;
    textHi: string;
    textMid: string;
    textLow: string;
    glassBg: string;
    glassBgStrong: string;
    glassBorder: string;
    glassHighlight: string;
    clayShadow: string;
    /** The wind-down wash laid over everything. Must suit the surface. */
    veil: string;
    /** Drifting specks in the background. */
    speck: string;
  };
}

const NIGHT_SHADOW =
  '0 18px 40px -18px rgba(3, 6, 18, 0.9), 0 2px 0 0 rgba(255, 255, 255, 0.08) inset, 0 -10px 22px -18px rgba(255, 255, 255, 0.4) inset';
const DAY_SHADOW =
  '0 16px 32px -20px rgba(30, 40, 70, 0.45), 0 2px 0 0 rgba(255, 255, 255, 0.9) inset, 0 -8px 20px -18px rgba(30, 40, 70, 0.18) inset';

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    emoji: '🌌',
    mode: 'night',
    blurb: 'Deep indigo and lantern-light. Built for bedtime.',
    tokens: {
      ink900: '#070a16', ink800: '#0d1226', ink700: '#151c38', ink600: '#1e2749',
      accent: '#ffcf8f', accentSoft: '#ffe0b4', accentStrong: '#f2a65a', onAccent: '#2a1605',
      pop1: '#ffb4c4', pop2: '#b9a6ff', pop3: '#9ff0d4',
      textHi: '#fdf6ec', textMid: 'rgba(253,246,236,0.76)', textLow: 'rgba(253,246,236,0.5)',
      glassBg: 'rgba(255,255,255,0.07)', glassBgStrong: 'rgba(255,255,255,0.12)',
      glassBorder: 'rgba(255,255,255,0.16)', glassHighlight: 'rgba(255,255,255,0.34)',
      clayShadow: NIGHT_SHADOW,
      veil: 'radial-gradient(120% 100% at 50% 100%, rgba(255,176,92,0.5), rgba(10,6,20,0.78))',
      speck: '#fff6e2',
    },
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🪐',
    mode: 'night',
    blurb: 'Purple space with a bright turquoise pop.',
    tokens: {
      ink900: '#0b0718', ink800: '#170c2c', ink700: '#241246', ink600: '#331b60',
      accent: '#5ee7d0', accentSoft: '#a4f3e5', accentStrong: '#22b8a0', onAccent: '#04201b',
      pop1: '#ff9ecb', pop2: '#c2a3ff', pop3: '#ffd86b',
      textHi: '#f6f1ff', textMid: 'rgba(246,241,255,0.76)', textLow: 'rgba(246,241,255,0.5)',
      glassBg: 'rgba(255,255,255,0.07)', glassBgStrong: 'rgba(255,255,255,0.13)',
      glassBorder: 'rgba(196,166,255,0.24)', glassHighlight: 'rgba(255,255,255,0.32)',
      clayShadow: NIGHT_SHADOW,
      veil: 'radial-gradient(120% 100% at 50% 100%, rgba(94,231,208,0.34), rgba(11,7,24,0.8))',
      speck: '#d9ccff',
    },
  },
  {
    id: 'meadow',
    name: 'Meadow',
    emoji: '🌿',
    mode: 'day',
    blurb: 'Fresh green and coral. Bright and outdoorsy.',
    tokens: {
      ink900: '#eefaf0', ink800: '#dff4e5', ink700: '#cbecd7', ink600: '#b4e2c7',
      accent: '#ff7a59', accentSoft: '#ffa184', accentStrong: '#e2543a', onAccent: '#3d1206',
      pop1: '#2f9e6b', pop2: '#7c6bd6', pop3: '#f2b705',
      textHi: '#12321f', textMid: 'rgba(18,50,31,0.76)', textLow: 'rgba(18,50,31,0.55)',
      glassBg: 'rgba(255,255,255,0.62)', glassBgStrong: 'rgba(255,255,255,0.82)',
      glassBorder: 'rgba(18,50,31,0.12)', glassHighlight: 'rgba(255,255,255,0.95)',
      clayShadow: DAY_SHADOW,
      veil: 'radial-gradient(120% 100% at 50% 100%, rgba(255,160,110,0.42), rgba(255,226,196,0.62))',
      speck: '#2f9e6b',
    },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    emoji: '🍭',
    mode: 'day',
    blurb: 'Pink and lavender, with a grape-purple button.',
    tokens: {
      ink900: '#fff0f6', ink800: '#ffe3ef', ink700: '#fdd3e6', ink600: '#f8c0dc',
      accent: '#8b5cf6', accentSoft: '#b292fb', accentStrong: '#6d3fd6', onAccent: '#ffffff',
      pop1: '#ef5da8', pop2: '#3aa8c1', pop3: '#ffb020',
      textHi: '#3c1130', textMid: 'rgba(60,17,48,0.75)', textLow: 'rgba(60,17,48,0.55)',
      glassBg: 'rgba(255,255,255,0.6)', glassBgStrong: 'rgba(255,255,255,0.84)',
      glassBorder: 'rgba(60,17,48,0.12)', glassHighlight: 'rgba(255,255,255,0.95)',
      clayShadow: DAY_SHADOW,
      veil: 'radial-gradient(120% 100% at 50% 100%, rgba(255,150,205,0.4), rgba(255,226,240,0.62))',
      speck: '#ef5da8',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🐳',
    mode: 'day',
    blurb: 'Sea blue with a tangerine button. Calm but awake.',
    tokens: {
      ink900: '#eaf6fd', ink800: '#d8eefb', ink700: '#c1e3f7', ink600: '#a6d6f2',
      accent: '#f97316', accentSoft: '#fb9a4e', accentStrong: '#d95c07', onAccent: '#2b1000',
      pop1: '#0e7ea8', pop2: '#6b6bd6', pop3: '#12b886',
      textHi: '#0a2b3d', textMid: 'rgba(10,43,61,0.75)', textLow: 'rgba(10,43,61,0.55)',
      glassBg: 'rgba(255,255,255,0.6)', glassBgStrong: 'rgba(255,255,255,0.84)',
      glassBorder: 'rgba(10,43,61,0.12)', glassHighlight: 'rgba(255,255,255,0.95)',
      clayShadow: DAY_SHADOW,
      veil: 'radial-gradient(120% 100% at 50% 100%, rgba(255,170,90,0.4), rgba(255,231,205,0.6))',
      speck: '#0e7ea8',
    },
  },
  {
    id: 'jungle',
    name: 'Jungle',
    emoji: '🦜',
    mode: 'night',
    blurb: 'Deep leafy green with a parrot-yellow pop.',
    tokens: {
      ink900: '#05140f', ink800: '#0a2219', ink700: '#103326', ink600: '#174635',
      accent: '#ffd43b', accentSoft: '#ffe479', accentStrong: '#e0ad00', onAccent: '#22200a',
      pop1: '#ff8f6b', pop2: '#5ee7d0', pop3: '#c2a3ff',
      textHi: '#eefbf3', textMid: 'rgba(238,251,243,0.76)', textLow: 'rgba(238,251,243,0.5)',
      glassBg: 'rgba(255,255,255,0.07)', glassBgStrong: 'rgba(255,255,255,0.13)',
      glassBorder: 'rgba(148,227,190,0.22)', glassHighlight: 'rgba(255,255,255,0.32)',
      clayShadow: NIGHT_SHADOW,
      veil: 'radial-gradient(120% 100% at 50% 100%, rgba(255,212,59,0.34), rgba(5,20,15,0.8))',
      speck: '#ffe479',
    },
  },
];

export const DEFAULT_THEME = 'midnight';

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string): Theme {
  return THEME_BY_ID.get(id) ?? THEME_BY_ID.get(DEFAULT_THEME)!;
}

/** Maps a palette onto the CSS custom properties the stylesheet already uses. */
export function themeVariables(theme: Theme): Record<string, string> {
  const t = theme.tokens;
  return {
    '--ink-900': t.ink900,
    '--ink-800': t.ink800,
    '--ink-700': t.ink700,
    '--ink-600': t.ink600,
    '--amber-400': t.accent,
    '--amber-300': t.accentSoft,
    '--amber-500': t.accentStrong,
    '--on-accent': t.onAccent,
    '--rose-400': t.pop1,
    '--violet-400': t.pop2,
    '--mint-400': t.pop3,
    '--text-hi': t.textHi,
    '--text-mid': t.textMid,
    '--text-low': t.textLow,
    '--glass-bg': t.glassBg,
    '--glass-bg-strong': t.glassBgStrong,
    '--glass-border': t.glassBorder,
    '--glass-highlight': t.glassHighlight,
    '--clay-shadow': t.clayShadow,
    '--veil': t.veil,
    '--speck': t.speck,
  };
}
