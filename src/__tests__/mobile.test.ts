import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Pins the mobile platform layer the way `privacy.test.ts` pins the policy.
 *
 * None of these reproduce in a desktop browser or in Chromium's device
 * emulation, and none of them are visible in a screenshot — a sticky tap
 * highlight, a status bar that fights the palette, content under the notch.
 * They are exactly the kind of fix that gets silently reverted by a later
 * refactor, so each one gets a test instead of a comment.
 */
/**
 * Comments are stripped first, for the same reason `privacy.test.ts` strips
 * them: index.html documents *why* it never sets `user-scalable=no`, and a scan
 * that reads prose flags the explanation as the offence.
 */
const HTML = readFileSync('index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const CSS = readFileSync('src/styles/global.css', 'utf8');
const TOKENS = readFileSync('src/styles/tokens.css', 'utf8');

describe('viewport', () => {
  it('opts into the safe-area insets', () => {
    // Without viewport-fit=cover every env(safe-area-inset-*) resolves to 0px,
    // so the padding below would be a no-op that looks correct in the source.
    expect(HTML).toMatch(/viewport-fit=cover/);
  });

  it('lets the Android keyboard resize the layout viewport', () => {
    expect(HTML).toMatch(/interactive-widget=resizes-content/);
  });

  it('never disables zoom', () => {
    // The accessibility failure people reach for when an input zooms the page.
    // The fix is the 16px rule below, not taking pinch-zoom away from a parent.
    expect(HTML).not.toMatch(/user-scalable\s*=\s*no/);
    expect(HTML).not.toMatch(/maximum-scale/);
  });

  it('gives each colour scheme its own status bar colour', () => {
    const tags = HTML.match(/<meta name="theme-color"[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.every((tag) => tag.includes('prefers-color-scheme'))).toBe(true);
  });
});

describe('touch', () => {
  it('kills the tap highlight', () => {
    expect(CSS).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
  });

  it('gives every tappable thing its own press state', () => {
    // Removing the highlight removes the only feedback the WebView provided,
    // so :active is no longer optional.
    for (const selector of ['.btn', '.chip', '.tile', '.swatch', '.letters__card']) {
      expect(CSS).toContain(`${selector}:active`);
    }
  });

  it('opts controls out of the double-tap-zoom wait and long-press selection', () => {
    expect(CSS).toMatch(/touch-action:\s*manipulation/);
    expect(CSS).toMatch(/-webkit-user-select:\s*none/);
  });

  it('keeps inputs at 16px so iOS does not zoom on focus', () => {
    expect(CSS).toMatch(/input,\s*textarea,\s*select\s*\{\s*font-size:\s*16px/);
  });

  it('does not chain overscroll to the page', () => {
    expect(CSS).toMatch(/overscroll-behavior:\s*none/);
  });
});

describe('layout', () => {
  it('sizes the app shell with dvh', () => {
    // 100vh is the viewport with the chrome collapsed, so it overflows by the
    // height of the address bar for as long as the address bar is showing.
    expect(CSS).toMatch(/min-height:\s*100dvh/);
    expect(CSS).not.toMatch(/height:\s*100vh/);
  });

  it('pads content out of the notch and the home indicator', () => {
    expect(CSS).toMatch(/env\(safe-area-inset-top/);
    expect(CSS).toMatch(/env\(safe-area-inset-bottom/);
  });
});

describe('motion tokens', () => {
  it('uses the sanctioned curves rather than hand-rolled ones', () => {
    expect(TOKENS).toContain('cubic-bezier(0.23, 1, 0.32, 1)');
    expect(TOKENS).toContain('cubic-bezier(0.77, 0, 0.175, 1)');
  });

  it('keeps press feedback inside the 100-160ms window', () => {
    const press = TOKENS.match(/--dur-press:\s*(\d+)ms/);
    expect(press).not.toBeNull();
    expect(Number(press![1])).toBeGreaterThanOrEqual(100);
    expect(Number(press![1])).toBeLessThanOrEqual(160);
  });

  it('never animates a control for longer than 300ms', () => {
    // --dur-slow is the documented exception and paces the sleep gradient,
    // which is content rather than feedback.
    for (const name of ['--dur-press', '--dur-fast', '--dur-mid']) {
      const found = TOKENS.match(new RegExp(`${name}:\\s*(\\d+)ms`));
      expect(Number(found![1])).toBeLessThanOrEqual(300);
    }
  });

  it('softens motion under prefers-reduced-motion without deleting it', () => {
    // Zeroing every duration also removes the colour and opacity transitions
    // that make a state change legible, which is the opposite of the intent.
    const block = TOKENS.slice(TOKENS.indexOf('prefers-reduced-motion'));
    const durations = [...block.matchAll(/--dur-(?:fast|mid|slow):\s*(\d+)ms/g)];
    expect(durations.length).toBe(3);
    expect(durations.every(([, ms]) => Number(ms) > 1)).toBe(true);
  });

  it('never uses transition: all', () => {
    expect(CSS).not.toMatch(/transition:\s*all/);
  });
});
