import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TIER_COLORS: Record<string, string> = {
  excellent: '#4ade80',
  great: '#86efac',
  above_average: '#fde047',
  average: '#fdba74',
  below_average: '#fca5a5',
};

@Component({
  selector: 'ws-sparkline',
  standalone: true,
  host: { class: 'inline-flex items-center' },
  template: `
    @if (points().length > 1) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="viewBox()" class="overflow-visible">
        <defs>
          <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.3" />
            <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path [attr.d]="fillPath()" [attr.fill]="gradientUrl()" />
        <polyline [attr.points]="polylinePoints()" fill="none" [attr.stroke]="color()" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        <circle [attr.cx]="lastPoint().x" [attr.cy]="lastPoint().y" r="2" [attr.fill]="color()" />
      </svg>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly values = input.required<number[]>();
  readonly tier = input<string>('average');
  readonly width = input(60);
  readonly height = input(20);

  private static nextId = 0;
  private readonly id = Sparkline.nextId++;

  readonly gradientId = computed(() => `spark-grad-${this.id}`);
  readonly gradientUrl = computed(() => `url(#${this.gradientId()})`);
  readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);

  readonly color = computed(() => TIER_COLORS[this.tier()] ?? '#fdba74');

  readonly points = computed(() => {
    const vals = this.values();
    const w = this.width();
    const h = this.height();
    const pad = 2;

    if (vals.length < 2) {
      return [];
    }

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const stepX = (w - pad * 2) / (vals.length - 1);

    return vals.map((v, i) => ({
      x: pad + i * stepX,
      y: pad + (1 - (v - min) / range) * (h - pad * 2),
    }));
  });

  readonly polylinePoints = computed(() =>
    this.points()
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
  );

  readonly fillPath = computed(() => {
    const pts = this.points();
    const h = this.height();

    if (pts.length < 2) {
      return '';
    }

    const line = pts.map((p) => `L${p.x},${p.y}`).join(' ');

    return `M${pts[0].x},${h} ${line} L${pts[pts.length - 1].x},${h} Z`;
  });

  readonly lastPoint = computed(() => {
    const pts = this.points();

    return pts[pts.length - 1] ?? { x: 0, y: 0 };
  });
}
