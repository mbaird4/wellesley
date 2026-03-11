import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BatterVsStats, VsWellesleyData } from '@ws/core/models';

import { VsWellesleyTable } from './vs-wellesley-table';

@Component({
  selector: 'ws-vs-wellesley-view',
  standalone: true,
  imports: [VsWellesleyTable],
  host: { class: 'flex flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="loading-state">
        <i class="fa-solid fa-baseball loading-spinner"></i>
        Loading...
      </div>
    }

    @if (data(); as d) {
      @if (d.overall.length === 0) {
        <div class="py-section px-card text-content-dim text-center text-[1.05rem]">No games vs Wellesley found for {{ teamName() }}.</div>
      } @else {
        <div class="flex flex-col gap-1">
          <span class="text-content-dim text-sm"> {{ d.games.length }} {{ d.games.length === 1 ? 'game' : 'games' }} ({{ gameDates() }}) </span>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button class="cursor-pointer rounded-lg border-none px-3 py-1.5 text-sm font-medium transition-colors" [class]="selectedPitcher() === null ? 'bg-brand-bg text-brand-text' : 'bg-surface-elevated text-content-muted hover:text-content-bright'" (click)="selectedPitcher.set(null)">All</button>
          @for (pitcher of d.wellesleyPitchers; track pitcher) {
            <button class="cursor-pointer rounded-lg border-none px-3 py-1.5 text-sm font-medium transition-colors" [class]="selectedPitcher() === pitcher ? 'bg-brand-bg text-brand-text' : 'bg-surface-elevated text-content-muted hover:text-content-bright'" (click)="selectedPitcher.set(pitcher)">
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

  readonly selectedPitcher = signal<string | null>(null);

  readonly displayStats = computed<BatterVsStats[]>(() => {
    const d = this.data();

    if (!d) {
      return [];
    }

    const pitcher = this.selectedPitcher();

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
