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
  templateUrl: './vs-wellesley-view.html',
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
