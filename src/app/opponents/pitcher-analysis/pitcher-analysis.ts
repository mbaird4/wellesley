import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { OpponentPitchingData } from '@ws/data-access';
import { BreakpointService } from '@ws/shared/util';
import type { PitcherGameLog, PitcherSeasonSummary } from '@ws/stats-core';
import {
  computePitcherGameLog,
  computePitcherSeasonSummary,
  trackPitcherPerformance,
} from '@ws/stats-core';

import { InningBreakdown } from './inning-breakdown';
import { PitcherGameLogComponent } from './pitcher-game-log';
import type { PitcherOverviewData } from './pitcher-overview';
import { PitcherOverview } from './pitcher-overview';
import type { PitcherOption } from './pitcher-selector';
import { PitcherSelector } from './pitcher-selector';

@Component({
  selector: 'ws-pitcher-analysis',
  standalone: true,
  imports: [
    PitcherSelector,
    PitcherOverview,
    InningBreakdown,
    PitcherGameLogComponent,
  ],
  host: { class: 'block' },
  templateUrl: './pitcher-analysis.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitcherAnalysis {
  readonly bp = inject(BreakpointService);

  readonly pitchingData = input.required<OpponentPitchingData | null>();
  readonly loading = input<boolean>(false);

  readonly selectedPitcher = signal<string | null>(null);

  /** All pitcher names from pitching stats (across all years) */
  readonly pitcherList = computed<PitcherOption[]>(() => {
    const data = this.pitchingData();

    if (!data) {
      return [];
    }

    const names = new Set<string>();

    Object.values(data.pitchingStatsByYear).forEach((pitchers) => {
      pitchers.forEach((p) => names.add(p.name));
    });

    return Array.from(names).map((name) => ({
      name,
      label: name,
    }));
  });

  /** Auto-select first pitcher when list changes */
  readonly effectivePitcher = computed(() => {
    const selected = this.selectedPitcher();
    const list = this.pitcherList();

    if (selected && list.some((p) => p.name === selected)) {
      return selected;
    }

    return list[0]?.name ?? null;
  });

  /** Raw stats for the selected pitcher (most recent year) */
  readonly rawStats = computed<PitcherOverviewData | null>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();

    if (!data || !pitcher) {
      return null;
    }

    // Find the most recent year's stats for this pitcher
    const years = Object.keys(data.pitchingStatsByYear)
      .map(Number)
      .sort((a, b) => b - a);

    for (const year of years) {
      const stats = data.pitchingStatsByYear[String(year)];
      const found = stats?.find((p) => p.name === pitcher);

      if (found) {
        return found;
      }
    }

    return null;
  });

  /** Process all games to get season summary for selected pitcher */
  readonly seasonSummary = computed<PitcherSeasonSummary | null>(() => {
    const data = this.pitchingData();
    const pitcher = this.effectivePitcher();

    if (!data || !pitcher) {
      return null;
    }

    // Track pitcher performance across all games
    const allGameLogs: PitcherGameLog[] = [];

    data.games.forEach((game) => {
      const plays = trackPitcherPerformance(
        game.battingInnings,
        game.pitchers
      );

      const logs = computePitcherGameLog(plays, {
        date: game.date,
        opponent: game.opponent,
        url: game.url,
      });

      allGameLogs.push(...logs);
    });

    // Compute season summaries for all pitchers
    const summaries = computePitcherSeasonSummary(allGameLogs);

    return summaries.find((s) => s.pitcher === pitcher) ?? null;
  });

  selectPitcher(name: string): void {
    this.selectedPitcher.set(name);
  }
}
