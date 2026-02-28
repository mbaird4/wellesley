import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { getWobaTier } from '@ws/stats-core';
import { formatWoba, tierClass } from '@ws/stats-core';

@Component({
  selector: 'ws-woba-badge',
  standalone: true,
  host: { class: 'flex items-baseline justify-center gap-1' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="text-[0.95rem] font-semibold">{{
      formattedCumulative()
    }}</span>
    <span
      class="text-[0.7rem] font-semibold opacity-60"
      [class]="seasonTierClass()"
    >
      {{ formattedSeason() }}
      <span class="text-[0.6rem] opacity-80">{{ seasonPa() }}</span>
    </span>
  `,
})
export class WobaBadge {
  readonly cumulativeWoba = input.required<number>();
  readonly seasonWoba = input.required<number>();
  readonly seasonPa = input.required<number>();

  readonly formattedCumulative = computed(() =>
    formatWoba(this.cumulativeWoba())
  );
  readonly formattedSeason = computed(() => formatWoba(this.seasonWoba()));
  readonly seasonTierClass = computed(() =>
    tierClass(getWobaTier(this.seasonWoba()))
  );
}
