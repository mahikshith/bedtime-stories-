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

    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
      delete root.dataset.theme;
    };
  }, [themeId]);
}
