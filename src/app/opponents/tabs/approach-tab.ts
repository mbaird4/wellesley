import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { SoftballDataService } from '@ws/core/data';
import type { BatterSwingStats, GameData } from '@ws/core/models';
import { buildOpponentPitcherSequences, computeBatterSwingStats } from '@ws/core/processors';
import { EmptyState, LoadingState, SwingRateTable } from '@ws/core/ui';
import { CURRENT_YEAR } from '@ws/core/util';

import { OpponentDataService } from '../opponent-data.service';

@Component({
  selector: 'ws-approach-tab',
  standalone: true,
  imports: [
    EmptyState,
    LoadingState,
    SwingRateTable,
  ],
  host: { class: 'block' },
  templateUrl: './approach-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproachTab {
  readonly data = inject(OpponentDataService);
  private readonly softballData = inject(SoftballDataService);

  readonly loading = signal(false);
  readonly games = signal<GameData[]>([]);

  readonly stats = computed<BatterSwingStats[]>(() => {
    const gameData = this.games();
    const team = this.data.teamData();

    if (!gameData.length || !team) {
      return [];
    }

    const records = buildOpponentPitcherSequences(gameData);
    const allStats = computeBatterSwingStats(records);
    const rosterNames = new Set(team.players.map((p) => p.name));

    return allStats.filter((s) => rosterNames.has(s.batterName));
  });

  readonly jerseyMap = computed<Record<string, number>>(() => {
    const team = this.data.teamData();

    if (!team) {
      return {};
    }

    const map: Record<string, number> = {};
    team.players.forEach((p) => {
      if (p.jerseyNumber !== null) {
        map[p.name] = p.jerseyNumber;
      }
    });

    return map;
  });

  constructor() {
    effect(() => {
      const dir = this.data.dataDir();

      if (dir) {
        this.loadGameData(dir);
      }
    });
  }

  private loadGameData(dataDir: string): void {
    this.loading.set(true);

    this.softballData.getOpponentGameData(dataDir, CURRENT_YEAR).subscribe({
      next: (games) => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => {
        this.games.set([]);
        this.loading.set(false);
      },
    });
  }
}
