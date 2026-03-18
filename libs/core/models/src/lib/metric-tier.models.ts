export type MetricTier = 'excellent' | 'great' | 'above_average' | 'average' | 'below_average';

/** HSL color stop: [threshold, hue, saturation, lightness] */
export type ColorStop = [number, number, number, number];

/**
 * Defines a tiered color scale for any numeric metric.
 * Consumers provide their own thresholds and color stops
 * so the same display utilities work for wOBA, batting avg, ERA, etc.
 */
export interface MetricScale {
  /** HSL color stops for interpolation, sorted ascending by threshold */
  colorStops: ColorStop[];
  /** Tier breakpoints — sorted descending for higher-is-better, ascending for lower-is-better */
  tierBreakpoints: { threshold: number; tier: MetricTier }[];
  /** Set true when lower values are better (e.g., ERA, strand rate). Default: higher is better. */
  lowerIsBetter?: boolean;
}
