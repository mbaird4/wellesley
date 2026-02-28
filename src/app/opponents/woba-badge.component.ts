import { Component, computed, input } from '@angular/core';
import { getWobaTier } from '../../lib/woba';
import { formatWoba, tierClass } from '../../lib/woba-display';

@Component({
  selector: 'app-woba-badge',
  standalone: true,
  host: { class: 'flex items-baseline justify-center gap-1' },
  template: `
    <span class="text-[0.95rem] font-semibold">{{ formattedCumulative() }}</span>
    <span class="text-[0.7rem] font-semibold opacity-60" [class]="seasonTierClass()">
      {{ formattedSeason() }}
      <span class="text-[0.6rem] opacity-80">{{ seasonPa() }}</span>
    </span>
  `,
})
export class WobaBadgeComponent {
  readonly cumulativeWoba = input.required<number>();
  readonly seasonWoba = input.required<number>();
  readonly seasonPa = input.required<number>();

  readonly formattedCumulative = computed(() => formatWoba(this.cumulativeWoba()));
  readonly formattedSeason = computed(() => formatWoba(this.seasonWoba()));
  readonly seasonTierClass = computed(() => tierClass(getWobaTier(this.seasonWoba())));
}
