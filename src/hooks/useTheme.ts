import { useEffect } from 'react';
import { getTheme, themeVariables } from '../content/themes';

/**
 * Applies the chosen palette to the document root.
 *
 * Inline custom properties on `:root` beat the stylesheet's own `:root` block,
 * so every component keeps reading the same token names and none of them need
 * to know a theme exists. Also sets `color-scheme` so form controls, scrollbars
 * and the WebView's own chrome follow the palette instead of fighting it.
 */
export function useTheme(themeId: string): void {
  useEffect(() => {
    const theme = getTheme(themeId);
    const root = document.documentElement;
    const vars = themeVariables(theme);

    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.style.colorScheme = theme.mode === 'day' ? 'light' : 'dark';
    root.dataset.theme = theme.id;

    /*
     * The status bar and the WebView's own chrome take their colour from
     * theme-color, not from the page. Left at the one hardcoded midnight value
     * in index.html, all three light palettes rendered a black bar above a
     * cream app. Both media-scoped tags are retargeted, because which one wins
     * depends on the OS setting rather than on the palette the parent picked.
     */
    const bars = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = [...bars].map((bar) => bar.content);
    for (const bar of bars) bar.content = theme.tokens.ink900;

    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
      delete root.dataset.theme;
      bars.forEach((bar, i) => { bar.content = previous[i]; });
    };
  }, [themeId]);
}
