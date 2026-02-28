import { WobaTier } from './types';

export function formatWoba(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

export function tierClass(tier: WobaTier | string): string {
  return `tier-${tier}`;
}

export function wobaGradientStyle(woba: number): Record<string, string> {
  const stops: [number, number, number, number][] = [
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
  ];

  const w = Math.max(0, Math.min(0.55, woba));
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1][0] <= w) i++;
  const [w0, h0, s0, l0] = stops[i];
  const [w1, h1, s1, l1] = stops[Math.min(i + 1, stops.length - 1)];
  const t = w1 > w0 ? (w - w0) / (w1 - w0) : 0;
  const h = h0 + t * (h1 - h0);
  const s = s0 + t * (s1 - s0);
  const l = l0 + t * (l1 - l0);

  const topColor = `hsl(${h + 8}, ${s + 5}%, ${l + 14}%)`;
  const bottomColor = `hsl(${h}, ${s}%, ${l}%)`;
  return {
    background: `linear-gradient(to bottom, ${topColor}, ${bottomColor})`,
    '-webkit-background-clip': 'text',
    'background-clip': 'text',
    '-webkit-text-fill-color': 'transparent',
  };
}
