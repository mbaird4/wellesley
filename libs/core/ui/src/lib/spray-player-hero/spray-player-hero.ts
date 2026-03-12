import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SprayChartSummary, SprayTrend, SprayZone } from '@ws/core/models';
import { CENTER_ZONES, LEFT_ZONES, RIGHT_ZONES } from '@ws/core/processors';

import { FormatStatPipe } from '../pipes/format-stat.pipe';
import { SprayTrendBadge } from '../spray-trend-badge/spray-trend-badge';

@Component({
  selector: 'ws-spray-player-hero',
  standalone: true,
  imports: [
    FormatStatPipe,
    SprayTrendBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1' },
  template: `
    <div class="flex items-baseline gap-3">
      @if (jersey() !== undefined) {
        <span class="text-content-dim text-sm font-medium">#{{ jersey() }}</span>
      }
      <span class="text-content-heading text-2xl font-bold">
        {{ name() }}
      </span>
    </div>
    <div class="text-content-muted flex items-baseline gap-3 text-sm tabular-nums">
      <span>
        <span class="font-stat text-content-bright font-bold">
          {{ totalContact() }}
        </span>
        batted balls
      </span>
      <span class="text-content-dim">&middot;</span>
      <span>
        <span class="font-stat text-content-bright font-bold">
          {{ avg() | formatStat: 'avg' }}
        </span>
        avg on contact
      </span>
    </div>
    <div class="text-content-dim flex gap-3 text-xs tabular-nums">
      <span>Left {{ leftPct() }}%</span>
      <span>&middot;</span>
      <span>Center {{ centerPct() }}%</span>
      <span>&middot;</span>
      <span>Right {{ rightPct() }}%</span>
    </div>
    @if (trends().length > 0) {
      <div class="flex flex-wrap gap-1.5 pt-0.5">
        @for (trend of trends(); track trend.type) {
          <ws-spray-trend-badge [trend]="trend" />
        }
      </div>
    }
  `,
})
export class SprayPlayerHero {
  readonly name = input.required<string>();
  readonly jersey = input<number>();
  readonly summary = input.required<SprayChartSummary>();
  readonly trends = input<SprayTrend[]>([]);

  readonly totalContact = computed(() => this.summary().totalContact);

  readonly avg = computed(() => {
    const s = this.summary();

    if (s.totalContact === 0) {
      return 0;
    }

    const hits = s.zones.reduce((sum, z) => sum + z.hits, 0);

    return hits / s.totalContact;
  });

  readonly leftPct = computed(() => this.zonePct(LEFT_ZONES));
  readonly centerPct = computed(() => this.zonePct(CENTER_ZONES));
  readonly rightPct = computed(() => this.zonePct(RIGHT_ZONES));

  private zonePct(zones: Set<SprayZone>): number {
    const s = this.summary();

    if (s.totalContact === 0) {
      return 0;
    }

    const total = s.zones.filter((z) => zones.has(z.zone)).reduce((sum, z) => sum + z.total, 0);

    return Math.round((total / s.totalContact) * 100);
  }
}
