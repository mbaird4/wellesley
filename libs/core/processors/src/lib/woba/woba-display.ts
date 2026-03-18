import type { MetricScale } from '@ws/core/models';

import { metricColorStyle, metricGradientStyle } from '../metric-display';

export { tierClass } from '../metric-display';

export const WOBA_SCALE: MetricScale = {
  colorStops: [
    [0.0, 0, 85, 72],
    [0.15, 10, 85, 70],
    [0.22, 22, 88, 68],
    [0.26, 32, 90, 66],
    [0.29, 42, 90, 64],
    [0.31, 55, 88, 62],
    [0.33, 68, 82, 60],
    [0.35, 85, 78, 58],
    [0.37, 105, 72, 58],
    [0.4, 130, 68, 58],
    [0.45, 145, 72, 55],
    [0.55, 155, 78, 52],
  ],
  tierBreakpoints: [
    { threshold: 0.4, tier: 'excellent' },
    { threshold: 0.35, tier: 'great' },
    { threshold: 0.32, tier: 'above_average' },
    { threshold: 0.29, tier: 'average' },
  ],
};

export function formatWoba(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

export function wobaGradientStyle(woba: number): Record<string, string> {
  return metricGradientStyle(woba, WOBA_SCALE);
}

/**
 * Solid color variant of wobaGradientStyle — avoids background-clip: text
 * which has intermittent rendering bugs in lazily-rendered content.
 */
export function wobaColorStyle(woba: number): Record<string, string> {
  return metricColorStyle(woba, WOBA_SCALE);
}
