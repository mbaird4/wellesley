import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { CdkDrag, CdkDragPlaceholder, CdkDragPreview, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { ButtonToggle, type ToggleOption } from '../button-toggle/button-toggle';
import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';

export type CoachSortMode = 'pa' | 'woba' | 'avg' | 'number';

const SORT_OPTIONS: ToggleOption[] = [
  { value: 'pa', label: 'PA' },
  { value: 'woba', label: 'wOBA' },
  { value: 'avg', label: 'AVG' },
  { value: 'number', label: '#' },
];

const SORT_FNS: Record<CoachSortMode, (a: PrintPlayerSummary, b: PrintPlayerSummary) => number> = {
  pa: (a, b) => (b.pa ?? 0) - (a.pa ?? 0),
  woba: (a, b) => (b.woba ?? 0) - (a.woba ?? 0),
  avg: (a, b) => (b.avg ?? 0) - (a.avg ?? 0),
  number: (a, b) => a.jersey - b.jersey,
};

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
  readonly orderChange = output<PrintPlayerSummary[]>();

  readonly sortOptions = SORT_OPTIONS;
  readonly sortMode = signal<CoachSortMode | 'custom'>('pa');
  readonly customOrder = signal<PrintPlayerSummary[]>([]);

  readonly sortedPlayers = computed(() => {
    const mode = this.sortMode();

    if (mode === 'custom') {
      return this.customOrder();
    }

    return [...this.players()].sort(SORT_FNS[mode]);
  });

  readonly displayRows = computed<DisplayRow[]>(() => {
    const sorted = this.sortedPlayers();
    const mode = this.sortMode();
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
      pa: cell(p.pa !== undefined ? String(p.pa) : '—', mode === 'pa', p.pa ?? 0),
      woba: cell(fmtAvg(p.woba), mode === 'woba', p.woba ?? 0),
      avg: cell(fmtAvg(p.avg), mode === 'avg', p.avg ?? 0),
    }));
  });

  constructor() {
    effect(() => {
      this.customOrder.set([...this.players()]);
    });

    effect(() => {
      this.orderChange.emit(this.sortedPlayers());
    });
  }

  onSortChange(value: string | string[]): void {
    this.sortMode.set(value as CoachSortMode);
  }

  onDrop(event: CdkDragDrop<PrintPlayerSummary[]>): void {
    const list = [...this.sortedPlayers()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.customOrder.set(list);
    this.sortMode.set('custom');
  }
}
