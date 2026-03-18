import type { ColorStop, MetricScale, MetricTier } from '@ws/core/models';

export function getMetricTier(value: number, scale: MetricScale): MetricTier {
  const match = scale.lowerIsBetter ? scale.tierBreakpoints.find((bp) => value <= bp.threshold) : scale.tierBreakpoints.find((bp) => value >= bp.threshold);

  return match?.tier ?? 'below_average';
}

export function tierClass(tier: MetricTier | string): string {
  return `tier-${tier}`;
}

function interpolateColor(value: number, stops: ColorStop[]): { h: number; s: number; l: number } {
  const minVal = stops[0][0];
  const maxVal = stops[stops.length - 1][0];
  const clamped = Math.max(minVal, Math.min(maxVal, value));

  const i = stops.reduce((acc, [threshold], idx) => (threshold <= clamped ? idx : acc), 0);

  const [w0, h0, s0, l0] = stops[i];
  const [w1, h1, s1, l1] = stops[Math.min(i + 1, stops.length - 1)];
  const t = w1 > w0 ? (clamped - w0) / (w1 - w0) : 0;

  return {
    h: h0 + t * (h1 - h0),
    s: s0 + t * (s1 - s0),
    l: l0 + t * (l1 - l0),
  };
}

export function metricGradientStyle(value: number, scale: MetricScale): Record<string, string> {
  const { h, s, l } = interpolateColor(value, scale.colorStops);

  const topColor = `hsl(${h + 8}, ${s + 5}%, ${l + 14}%)`;
  const bottomColor = `hsl(${h}, ${s}%, ${l}%)`;

  return {
    background: `linear-gradient(to bottom, ${topColor}, ${bottomColor})`,
    '-webkit-background-clip': 'text',
    'background-clip': 'text',
    '-webkit-text-fill-color': 'transparent',
  };
}

export function metricColorStyle(value: number, scale: MetricScale): Record<string, string> {
  const { h, s, l } = interpolateColor(value, scale.colorStops);

  return { color: `hsl(${h + 4}, ${s + 2}%, ${l + 7}%)` };
}
