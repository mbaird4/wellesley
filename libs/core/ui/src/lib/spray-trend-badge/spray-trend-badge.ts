import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SprayTrend } from '@ws/core/models';

@Component({
  selector: 'ws-spray-trend-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums" [class]="colorClasses()">
      <i class="fa-solid text-[9px]" [class]="arrowClass()"></i>
      {{ trend().label }}
    </span>
  `,
})
export class SprayTrendBadge {
  readonly trend = input.required<SprayTrend>();

  readonly colorClasses = computed(() => (this.trend().direction === 'up' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'));

  readonly arrowClass = computed(() => (this.trend().direction === 'up' ? 'fa-arrow-up' : 'fa-arrow-down'));
}
