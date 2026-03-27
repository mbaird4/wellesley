import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { CdkDrag, CdkDragPlaceholder, CdkDragPreview, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { ButtonToggle, type ToggleOption } from '../button-toggle/button-toggle';
import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';

export type CoachSortMode = 'lineup' | 'pa' | 'woba' | 'avg' | 'number';

interface CachedSortOrder {
  mode: CoachSortMode | 'custom';
  names?: string[];
}

const BASE_SORT_OPTIONS: ToggleOption[] = [
  { value: 'pa', label: 'PA' },
  { value: 'woba', label: 'wOBA' },
  { value: 'avg', label: 'AVG' },
  { value: 'number', label: '#' },
];

const LINEUP_OPTION: ToggleOption = { value: 'lineup', label: 'Lineup' };

const SORT_FNS: Record<Exclude<CoachSortMode, 'lineup'>, (a: PrintPlayerSummary, b: PrintPlayerSummary) => number> = {
  pa: (a, b) => (b.pa ?? 0) - (a.pa ?? 0),
  woba: (a, b) => (b.woba ?? 0) - (a.woba ?? 0),
  avg: (a, b) => (b.avg ?? 0) - (a.avg ?? 0),
  number: (a, b) => a.jersey - b.jersey,
};

function buildLineupSortFn(order: Record<string, number>): (a: PrintPlayerSummary, b: PrintPlayerSummary) => number {
  return (a, b) => {
    const aSlot = order[a.name] ?? 99;
    const bSlot = order[b.name] ?? 99;

    if (aSlot !== bSlot) {
      return aSlot - bSlot;
    }

    // Tie-break: non-lineup players sorted by PA desc
    return (b.pa ?? 0) - (a.pa ?? 0);
  };
}

const STAT_SORT_KEYS: Partial<Record<CoachSortMode, keyof PrintPlayerSummary>> = {
  pa: 'pa',
  woba: 'woba',
  avg: 'avg',
};

interface StatCell {
  value: string;
  cls: string;
  intensity: number | null;
}

interface DisplayRow {
  player: PrintPlayerSummary;
  lineupSlot: number | null;
  pa: StatCell;
  woba: StatCell;
  avg: StatCell;
}

function fmtAvg(val: number | undefined): string {
  return val !== undefined ? val.toFixed(3).replace(/^0/, '') : '—';
}

@Component({
  selector: 'ws-spray-coach-sort-panel',
  standalone: true,
  imports: [
    ButtonToggle,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    CdkDragPreview,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './spray-coach-sort-panel.html',
})
export class SprayCoachSortPanel {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly lineupOrder = input<Record<string, number>>({});
  readonly cacheKey = input<string>('');
  readonly orderChange = output<PrintPlayerSummary[]>();

  readonly hasLineup = computed(() => Object.keys(this.lineupOrder()).length > 0);

  readonly sortOptions = computed(() => (this.hasLineup() ? [LINEUP_OPTION, ...BASE_SORT_OPTIONS] : BASE_SORT_OPTIONS));

  readonly sortMode = signal<CoachSortMode | 'custom'>('pa');
  readonly customOrder = signal<PrintPlayerSummary[]>([]);

  readonly sortedPlayers = computed(() => {
    const mode = this.sortMode();

    if (mode === 'custom') {
      return this.customOrder();
    }

    if (mode === 'lineup') {
      return [...this.players()].sort(buildLineupSortFn(this.lineupOrder()));
    }

    return [...this.players()].sort(SORT_FNS[mode]);
  });

  readonly displayRows = computed<DisplayRow[]>(() => {
    const sorted = this.sortedPlayers();
    const mode = this.sortMode();
    const lineup = this.lineupOrder();
    const key = STAT_SORT_KEYS[mode as CoachSortMode];
    const isCustom = mode === 'custom';
    const neutralCls = isCustom ? 'text-content-dim' : 'text-content-empty';

    let min = 0;
    let range = 0;

    if (key) {
      const vals = sorted.map((p) => (p[key] as number) ?? 0);
      min = Math.min(...vals);
      range = Math.max(...vals) - min;
    }

    const cell = (value: string, active: boolean, rawVal: number): StatCell => {
      if (!active) {
        return { value, cls: neutralCls, intensity: null };
      }

      return {
        value,
        cls: 'text-brand-text',
        intensity: range > 0 ? 0.3 + 0.7 * ((rawVal - min) / range) : 1,
      };
    };

    return sorted.map((p) => ({
      player: p,
      lineupSlot: lineup[p.name] ?? null,
      pa: cell(p.pa !== undefined ? String(p.pa) : '—', mode === 'pa', p.pa ?? 0),
      woba: cell(fmtAvg(p.woba), mode === 'woba', p.woba ?? 0),
      avg: cell(fmtAvg(p.avg), mode === 'avg', p.avg ?? 0),
    }));
  });

  constructor() {
    // Initialize order: restore from cache or set defaults
    effect(() => {
      const players = this.players();
      const key = this.cacheKey();

      this.customOrder.set([...players]);

      const cached = key ? this.loadCache(key) : null;

      if (cached?.mode === 'custom' && cached.names?.length) {
        const nameOrder = new Map(cached.names.map((n, i) => [n, i]));
        const ordered = [...players].sort((a, b) => (nameOrder.get(a.name) ?? Infinity) - (nameOrder.get(b.name) ?? Infinity));
        this.customOrder.set(ordered);
        this.sortMode.set('custom');
      } else if (cached) {
        this.sortMode.set(cached.mode as CoachSortMode);
      } else if (this.hasLineup()) {
        this.sortMode.set('lineup');
      }
    });

    effect(() => {
      this.orderChange.emit(this.sortedPlayers());
    });
  }

  onSortChange(value: string | string[]): void {
    this.sortMode.set(value as CoachSortMode);
    this.saveCache();
  }

  onDrop(event: CdkDragDrop<PrintPlayerSummary[]>): void {
    const list = [...this.sortedPlayers()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.customOrder.set(list);
    this.sortMode.set('custom');
    this.saveCache();
  }

  private loadCache(key: string): CachedSortOrder | null {
    try {
      const raw = localStorage.getItem(`ws-print-order:${key}`);

      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveCache(): void {
    const key = this.cacheKey();

    if (!key) {
      return;
    }

    const mode = this.sortMode();
    const payload: CachedSortOrder = { mode };

    if (mode === 'custom') {
      payload.names = this.sortedPlayers().map((p) => p.name);
    }

    try {
      localStorage.setItem(`ws-print-order:${key}`, JSON.stringify(payload));
    } catch {
      // localStorage full or unavailable
    }
  }
}
