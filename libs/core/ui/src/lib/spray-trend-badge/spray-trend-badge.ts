import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SprayTrend } from '@ws/core/models';

const TREND_DESCRIPTIONS: Record<SprayTrend['type'], string> = {
  pull_shift: 'Pull-side batted ball percentage, last year vs. this year.',
  oppo_shift: 'Opposite-field batted ball percentage, last year vs. this year.',
  center_shift: 'Up-the-middle batted ball percentage, last year vs. this year.',
  more_hard: 'Hard contact percentage, last year vs. this year.',
  more_weak: 'Weak contact percentage, last year vs. this year.',
};

@Component({
  selector: 'ws-spray-trend-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <span class="group relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums" [class]="colorClasses()">
      <i class="fa-solid text-[9px]" [class]="arrowClass()"></i>
      {{ trend().label }}
      <i class="fa-solid fa-circle-question text-[9px] opacity-40 transition-opacity group-hover:opacity-80"></i>
      <span class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg bg-surface-card px-3 py-2 text-[15px] leading-snug font-normal text-content-secondary opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
        {{ description() }}
      </span>
    </span>
  `,
})
export class SprayTrendBadge {
  readonly trend = input.required<SprayTrend>();

  readonly colorClasses = computed(() => (this.trend().direction === 'up' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'));

  readonly arrowClass = computed(() => (this.trend().direction === 'up' ? 'fa-arrow-up' : 'fa-arrow-down'));

  readonly description = computed(() => TREND_DESCRIPTIONS[this.trend().type]);
}
