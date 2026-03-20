import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BatterVsStats, VsWellesleyData } from '@ws/core/models';
import { LoadingState } from '@ws/core/ui';

import { VsWellesleyTable } from './vs-wellesley-table';

@Component({
  selector: 'ws-vs-wellesley-view',
  standalone: true,
  imports: [
    LoadingState,
    VsWellesleyTable,
  ],
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <ws-loading-state />
    }

    @if (data(); as d) {
      @if (d.overall.length === 0) {
        <div class="py-section px-card text-content-dim text-center text-[1.05rem]">No games vs Wellesley found for {{ teamName() }}.</div>
      } @else {
        <div class="flex flex-col gap-1">
          <span class="text-content-dim text-sm"> {{ d.games.length }} {{ d.games.length === 1 ? 'game' : 'games' }} ({{ gameDates() }}) </span>
        </div>

        <div class="flex flex-wrap gap-1.5">
          @for (pitcher of filteredPitchers(); track pitcher) {
            <button class="cursor-pointer rounded-lg border-none px-3 py-1.5 text-sm font-medium transition-colors" [class]="activePitcher() === pitcher ? 'bg-brand-bg text-brand-text' : 'bg-surface-elevated text-content-muted hover:text-content-bright'" (click)="selectedPitcher.set(pitcher)">
              {{ pitcher }}
            </button>
          }
        </div>

        <ws-vs-wellesley-table [stats]="displayStats()" />
      }
    }

    @if (!data() && !loading()) {
      <div class="py-section px-card text-content-dim text-center text-[1.05rem]">No vs Wellesley data available for {{ teamName() }}.</div>
    }
  `,
})
export class VsWellesleyView {
  readonly data = input<VsWellesleyData | null>(null);
  readonly loading = input(false);
  readonly teamName = input('');
  readonly wellesleyRosterNames = input<Set<string>>(new Set());
  readonly pitcherOrder = input<string[]>([]);

  readonly selectedPitcher = signal<string | null>(null);

  readonly filteredPitchers = computed<string[]>(() => {
    const d = this.data();
    const roster = this.wellesleyRosterNames();
    const order = this.pitcherOrder();

    if (!d) {
      return [];
    }

    const pitchers = roster.size === 0 ? d.wellesleyPitchers : d.wellesleyPitchers.filter((p) => roster.has(p.toLowerCase().replace(/\./g, '')));

    const pitcherSet = new Set(pitchers);

    return order.filter((p) => pitcherSet.has(p));
  });

  readonly activePitcher = computed<string | null>(() => this.selectedPitcher() ?? this.filteredPitchers()[0] ?? null);

  readonly displayStats = computed<BatterVsStats[]>(() => {
    const d = this.data();

    if (!d) {
      return [];
    }

    const pitcher = this.activePitcher();

    if (pitcher === null) {
      return d.overall;
    }

    return d.byPitcher[pitcher] ?? [];
  });

  readonly gameDates = computed(() => {
    const d = this.data();

    if (!d) {
      return '';
    }

    return d.games.map((g) => g.date).join(', ');
  });
}
