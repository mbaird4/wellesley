/**
 * Simplified StyleReader utility for reading CSS custom properties from the document body.
 * Single-theme app — no dark mode toggling or memoization needed.
 */
export class StyleReader {
  static read(property: string): string {
    return window.getComputedStyle(document.body).getPropertyValue(property).trim();
  }

  static convertUnitToRaw(cssValue: string): number {
    if (!cssValue) {
      return 0;
    } // Default fallback

    // If value ends with 'rem', convert to pixels
    if (cssValue.endsWith('rem')) {
      const remValue = parseFloat(cssValue.replace('rem', ''));

      return remValue * 10; // 1rem = 10px (assuming 16px base font size)
    }

    // If value ends with 'px', return as is
    if (cssValue.endsWith('px')) {
      return parseFloat(cssValue.replace('px', ''));
    }

    // Default fallback
    return 0;
  }
}
