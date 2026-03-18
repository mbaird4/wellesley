import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RosterService } from '@ws/core/data';
import type { BattingMetric, PlayerLineupBreakdown } from '@ws/core/models';
import { wobaColorStyle } from '@ws/core/processors';
import { MetricToggle } from '@ws/core/ui';
import { BreakpointService } from '@ws/core/util';

export interface SlotCell {
  formatted: string;
  color: string;
  pa: number;
  hasData: boolean;
  rawValue: number;
  isMin: boolean;
  isMax: boolean;
}

export interface DisplayRow {
  player: PlayerLineupBreakdown;
  cells: SlotCell[];
  overallCell: SlotCell;
}

export interface DetailSlotRow {
  slot: number;
  pa: number;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  rbi: number;
  avgFormatted: string;
  wobaFormatted: string;
  avgColor: string;
  wobaColor: string;
}

function formatMetric(value: number, pa: number, metric: BattingMetric): string {
  if (pa === 0) {
    return '—';
  }

  return metric === 'woba' ? value.toFixed(3).replace(/^0/, '') : value.toFixed(3).replace(/^0\./, '.');
}

function metricColor(value: number, pa: number, metric: BattingMetric): string {
  if (pa === 0) {
    return '';
  }

  const scaled = metric === 'avg' ? value * 1.1 : value;

  return wobaColorStyle(scaled).color;
}

function buildCell(value: number, pa: number, metric: BattingMetric): SlotCell {
  return {
    formatted: formatMetric(value, pa, metric),
    color: metricColor(value, pa, metric),
    pa,
    hasData: pa > 0,
    rawValue: value,
    isMin: false,
    isMax: false,
  };
}

/** Mark the highest and lowest cells in a row when there are >3 data-bearing cells */
function tagMinMax(cells: SlotCell[]): void {
  const dataCells = cells.filter((c) => c.hasData);

  if (dataCells.length <= 1) {
    return;
  }

  let min = dataCells[0];
  let max = dataCells[0];

  dataCells.forEach((c) => {
    if (c.rawValue < min.rawValue) {
      min = c;
    }

    if (c.rawValue > max.rawValue) {
      max = c;
    }
  });

  if (min !== max) {
    min.isMin = true;
    max.isMax = true;
  }
}

@Component({
  selector: 'ws-player-lineup-table',
  standalone: true,
  imports: [MetricToggle],
  templateUrl: './player-lineup-table.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerLineupTable {
  readonly bp = inject(BreakpointService);
  private readonly roster = inject(RosterService);
  readonly players = input.required<PlayerLineupBreakdown[]>();
  readonly metric = signal<BattingMetric>('avg');
  readonly expandedPlayer = signal<string | null>(null);
  readonly slots = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  readonly rosterPlayers = computed(() => {
    const rosterNames = this.roster.wellesleyRosterAbbrevNames();
    const all = this.players();

    if (rosterNames.size === 0) {
      return all;
    }

    return all.filter((p) => rosterNames.has(p.name));
  });

  readonly rows = computed<DisplayRow[]>(() => {
    const m = this.metric();

    return this.rosterPlayers().map((p) => {
      const cells = p.bySlot.map((slot) => {
        if (!slot) {
          return { formatted: '—', color: '', pa: 0, hasData: false, rawValue: 0, isMin: false, isMax: false };
        }

        const value = m === 'woba' ? slot.woba : slot.avg;

        return buildCell(value, slot.stats.pa, m);
      });

      tagMinMax(cells);
      console.log(p.name, p);

      return {
        player: p,
        cells,
        overallCell: buildCell(m === 'woba' ? p.overallWoba : p.overallAvg, p.totalPa, m),
      };
    });
  });

  readonly expandedDetail = computed<DetailSlotRow[] | null>(() => {
    const name = this.expandedPlayer();

    if (!name) {
      return null;
    }

    const player = this.rosterPlayers().find((p) => p.name === name);

    if (!player) {
      return null;
    }

    return player.bySlot
      .map((slot, i) => {
        if (!slot) {
          return null;
        }

        const s = slot.stats;
        const singles = s.h - s.doubles - s.triples - s.hr;

        return {
          slot: i + 1,
          pa: s.pa,
          ab: s.ab,
          h: s.h,
          singles,
          doubles: s.doubles,
          triples: s.triples,
          hr: s.hr,
          bb: s.bb,
          hbp: s.hbp,
          rbi: slot.rbi,
          avgFormatted: formatMetric(slot.avg, s.ab, 'avg'),
          wobaFormatted: formatMetric(slot.woba, s.pa, 'woba'),
          avgColor: metricColor(slot.avg, s.ab, 'avg'),
          wobaColor: metricColor(slot.woba, s.pa, 'woba'),
        };
      })
      .filter((row): row is DetailSlotRow => row !== null);
  });

  togglePlayer(name: string): void {
    this.expandedPlayer.update((prev) => (prev === name ? null : name));
  }
}
