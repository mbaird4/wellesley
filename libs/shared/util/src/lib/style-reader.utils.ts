/**
 * Simplified StyleReader utility for reading CSS custom properties from the document body.
 * Single-theme app — no dark mode toggling or memoization needed.
 */
export class StyleReader {
  static read(property: string): string {
    return window
      .getComputedStyle(document.body)
      .getPropertyValue(property)
      .trim();
  }
}
