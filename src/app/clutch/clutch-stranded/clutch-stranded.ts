import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PlayerClutchSummary } from '@ws/core/models';

type SortKey = 'total' | 'third' | 'second' | 'first' | 'rate' | 'name';

interface StrandedRow {
  name: string;
  total: number;
  onFirst: number;
  onSecond: number;
  onThird: number;
  scoringPosStranded: number;
  pa: number;
  strandRate: string;
  strandRateValue: number;
}

function computeStrandedRow(player: PlayerClutchSummary): StrandedRow {
  let onFirst = 0;
  let onSecond = 0;
  let onThird = 0;

  player.events.forEach((e) => {
    e.runnersOn
      .filter((r) => r.outcome === 'stranded')
      .forEach((r) => {
        switch (r.baseBefore) {
          case 'first':
            onFirst++;
            break;
          case 'second':
            onSecond++;
            break;
          case 'third':
            onThird++;
            break;
        }
      });
  });

  const total = onFirst + onSecond + onThird;
  const strandRateValue = player.totalRunnersOn > 0 ? (total / player.totalRunnersOn) * 100 : 0;

  return {
    name: player.name,
    total,
    onFirst,
    onSecond,
    onThird,
    scoringPosStranded: onSecond + onThird,
    pa: player.runnersOnPa,
    strandRate: strandRateValue.toFixed(0),
    strandRateValue,
  };
}

@Component({
  selector: 'ws-clutch-stranded',
  standalone: true,
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Team totals -->
    <div class="flex flex-wrap gap-3">
      <div class="stat-card">
        <div class="stat-value">{{ teamTotals().total }}</div>
        <div class="stat-label">Total LOB</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-content-secondary">{{ teamTotals().onFirst }}</div>
        <div class="stat-label">Stranded on 1st</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-amber-400">{{ teamTotals().onSecond }}</div>
        <div class="stat-label">Stranded on 2nd</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-red-400">{{ teamTotals().onThird }}</div>
        <div class="stat-label">Stranded on 3rd</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ teamTotals().strandRate }}%</div>
        <div class="stat-label">Strand Rate</div>
      </div>
    </div>

    <p class="text-content-secondary text-sm leading-relaxed">
      <span class="text-content-bright font-semibold tabular-nums">{{ teamTotals().total }}</span>
      runners stranded{{ filterContext() ? ' ' + filterContext() : '' }}.
      <span class="text-content-bright tabular-nums">{{ teamTotals().scoringPosStranded }}</span>
      in scoring position.
      @if (worstOffender()) {
        <span class="text-content-bright font-semibold">{{ worstOffender()!.name }}</span>
        left the most on base (<span class="tabular-nums">{{ worstOffender()!.total }}</span> in {{ worstOffender()!.pa }} PA).
      }
    </p>

    <!-- Sort -->
    <div class="flex items-center gap-2">
      <span class="text-content-dim text-xs font-medium uppercase tracking-wider">Sort</span>
      @for (opt of sortOptions; track opt.key) {
        <button class="cursor-pointer rounded-md border-none px-2.5 py-1 text-xs font-medium transition-[color,background]" [class]="sort() === opt.key ? 'bg-brand-bg text-brand-text' : 'text-content-dim hover:text-content-secondary hover:bg-surface-card bg-transparent'" (click)="sort.set(opt.key)">
          {{ opt.label }}
        </button>
      }
    </div>

    <!-- Player rows -->
    <div class="flex flex-col gap-2">
      @for (row of sortedRows(); track row.name) {
        <div class="bg-surface-card border-line flex items-center gap-4 rounded-xl border px-card py-3">
          <!-- Name + totals -->
          <div class="flex min-w-[160px] flex-col gap-0.5">
            <span class="text-content-bright text-sm font-semibold">{{ row.name }}</span>
            <span class="text-content-dim text-xs tabular-nums">{{ row.pa }} PA · {{ row.strandRate }}% strand rate</span>
          </div>

          <!-- LOB total -->
          <div class="flex flex-col items-center gap-0.5">
            <span class="text-content-bright text-lg font-bold tabular-nums">{{ row.total }}</span>
            <span class="text-content-dim text-[0.65rem]">LOB</span>
          </div>

          <!-- Base breakdown as stacked bar -->
          <div class="flex flex-1 items-center gap-3">
            @if (row.onFirst > 0) {
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm bg-white/20"></span>
                <span class="text-content-secondary text-sm tabular-nums">{{ row.onFirst }}</span>
                <span class="text-content-dim text-[0.65rem]">1st</span>
              </div>
            }
            @if (row.onSecond > 0) {
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm bg-amber-400/70"></span>
                <span class="text-sm tabular-nums text-amber-400">{{ row.onSecond }}</span>
                <span class="text-content-dim text-[0.65rem]">2nd</span>
              </div>
            }
            @if (row.onThird > 0) {
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm bg-red-400/70"></span>
                <span class="text-sm tabular-nums text-red-400">{{ row.onThird }}</span>
                <span class="text-content-dim text-[0.65rem]">3rd</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ClutchStranded {
  readonly players = input.required<PlayerClutchSummary[]>();
  readonly filterContext = input('');

  readonly sort = signal<SortKey>('total');

  readonly sortOptions = [
    { key: 'total' as SortKey, label: 'Total LOB' },
    { key: 'rate' as SortKey, label: '% Stranded' },
    { key: 'third' as SortKey, label: 'On 3rd' },
    { key: 'second' as SortKey, label: 'On 2nd' },
    { key: 'name' as SortKey, label: 'Name' },
  ];

  readonly rows = computed<StrandedRow[]>(() =>
    this.players()
      .map(computeStrandedRow)
      .filter((r) => r.total > 0)
  );

  readonly sortedRows = computed<StrandedRow[]>(() => {
    const rows = [...this.rows()];
    const key = this.sort();

    rows.sort((a, b) => {
      switch (key) {
        case 'total':
          return b.total - a.total;
        case 'third':
          return b.onThird - a.onThird || b.total - a.total;
        case 'second':
          return b.onSecond - a.onSecond || b.total - a.total;
        case 'first':
          return b.onFirst - a.onFirst || b.total - a.total;
        case 'rate':
          return b.strandRateValue - a.strandRateValue || b.total - a.total;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return rows;
  });

  readonly teamTotals = computed(() => {
    const rows = this.rows();
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    const onFirst = rows.reduce((sum, r) => sum + r.onFirst, 0);
    const onSecond = rows.reduce((sum, r) => sum + r.onSecond, 0);
    const onThird = rows.reduce((sum, r) => sum + r.onThird, 0);
    const totalRunnersOn = this.players().reduce((sum, p) => sum + p.totalRunnersOn, 0);
    const strandRate = totalRunnersOn > 0 ? ((total / totalRunnersOn) * 100).toFixed(0) : '0';

    return {
      total,
      onFirst,
      onSecond,
      onThird,
      scoringPosStranded: onSecond + onThird,
      strandRate,
    };
  });

  readonly worstOffender = computed(() => {
    const rows = this.rows();

    if (rows.length === 0) {
      return null;
    }

    return [...rows].sort((a, b) => b.total - a.total)[0];
  });
}
