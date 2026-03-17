import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RosterService, SoftballStatsService } from '@ws/core/data';
import type { ClutchSummary, PbpBattingAccum, PlayerClutchSummary } from '@ws/core/models';
import { formatWoba, rebuildPlayerFromEvents } from '@ws/core/processors';
import { LastUpdatedPipe } from '@ws/core/ui';
import { ALL_SEASON_YEARS, CURRENT_YEAR } from '@ws/core/util';

import { ClutchFilters } from './clutch-filters/clutch-filters';
import { ClutchGameLog } from './clutch-game-log/clutch-game-log';
import type { ClutchMetric } from './clutch-metric';
import { ClutchPlayerTable } from './clutch-player-table/clutch-player-table';
import { ClutchStranded } from './clutch-stranded/clutch-stranded';
import { ClutchTeamSummary } from './clutch-team-summary/clutch-team-summary';

type ClutchTab = 'clutch' | 'stranded';

function calcAvg(stats: PbpBattingAccum): number {
  return stats.ab > 0 ? stats.h / stats.ab : 0;
}

function formatAvgValue(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

export interface TeamSummary {
  totalEvents: number;
  totalRunnersDrivenIn: number;
  totalRunnersOn: number;
  conversionRate: string;
  elevators: number;
  droppers: number;
  topClutchName: string;
  topClutchDelta: string;
}

const RISP_SITUATIONS = new Set(['second', 'third', 'first_second', 'first_third', 'second_third', 'loaded']);

function parseInningNumber(inning: string): number {
  const match = inning.match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function inningBucket(inning: string): 'early' | 'middle' | 'late' {
  const num = parseInningNumber(inning);

  if (num <= 3) {
    return 'early';
  }

  if (num <= 5) {
    return 'middle';
  }

  return 'late';
}

@Component({
  selector: 'ws-clutch',
  standalone: true,
  imports: [
    ClutchFilters,
    ClutchGameLog,
    ClutchPlayerTable,
    ClutchStranded,
    ClutchTeamSummary,
    LastUpdatedPipe,
  ],
  host: { class: 'block stats-section' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch.html',
})
export class Clutch {
  private statsService = inject(SoftballStatsService);
  private rosterService = inject(RosterService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly scrapedAt = signal<string | null>(null);
  readonly selectedYear = signal(CURRENT_YEAR);
  readonly clutchData = signal<ClutchSummary | null>(null);
  readonly selectedPlayerName = signal<string | null>(null);
  readonly activeTab = signal<ClutchTab>('clutch');
  readonly metric = signal<ClutchMetric>('woba');

  readonly availableYears = ALL_SEASON_YEARS;

  readonly outsFilter = signal<string[]>(['0', '1', '2']);
  readonly situationFilter = signal('runners-on');
  readonly inningFilter = signal<string[]>(['early', 'middle', 'late']);
  readonly pinchHitOnly = signal(false);

  readonly hasActiveFilters = computed(() => this.outsFilter().length !== 3 || this.situationFilter() !== 'runners-on' || this.inningFilter().length !== 3 || this.pinchHitOnly());

  readonly filterContext = computed(() => {
    const parts: string[] = [];

    const situation = this.situationFilter();
    if (situation === 'runners-on') {
      parts.push('with runners on base');
    } else if (situation === 'risp') {
      parts.push('with runners in scoring position');
    } else if (situation === 'loaded') {
      parts.push('with bases loaded');
    }

    const inning = this.inningFilter();
    if (inning.length > 0 && inning.length < 3) {
      const INNING_LABELS: Record<string, string> = { early: '1-3', middle: '4-5', late: '6+' };
      parts.push(`in innings ${inning.map((i) => INNING_LABELS[i]).join(', ')}`);
    }

    const outs = this.outsFilter();
    if (outs.length > 0 && outs.length < 3) {
      parts.push(outs.length === 1 ? `with ${outs[0]} out${outs[0] !== '1' ? 's' : ''}` : `with ${outs.join(' or ')} outs`);
    }

    if (this.pinchHitOnly()) {
      parts.push('as a pinch hitter');
    }

    return parts.join(', ');
  });

  readonly filteredPlayers = computed<PlayerClutchSummary[]>(() => {
    const data = this.clutchData();

    if (!data) {
      return [];
    }

    if (!this.hasActiveFilters()) {
      return data.players;
    }

    const outsArr = this.outsFilter();
    const situation = this.situationFilter();
    const inningArr = this.inningFilter();
    const phOnly = this.pinchHitOnly();

    return data.players
      .map((player) => {
        const filtered = player.events.filter((e) => {
          if (!outsArr.includes(String(e.outsBefore))) {
            return false;
          }

          if (situation === 'risp' && !RISP_SITUATIONS.has(e.baseSituation)) {
            return false;
          }

          if (situation === 'loaded' && e.baseSituation !== 'loaded') {
            return false;
          }

          if (!inningArr.includes(inningBucket(e.inning))) {
            return false;
          }

          if (phOnly && !e.isPinchHit) {
            return false;
          }

          return true;
        });

        if (filtered.length === 0) {
          return null;
        }

        return rebuildPlayerFromEvents(player.name, filtered, player);
      })
      .filter((p): p is PlayerClutchSummary => p !== null);
  });

  readonly teamSummary = computed<TeamSummary | null>(() => {
    const players = this.filteredPlayers();

    if (players.length === 0) {
      return null;
    }

    const m = this.metric();
    const totalEvents = players.reduce((sum, p) => sum + p.runnersOnPa, 0);
    const totalRunnersDrivenIn = players.reduce((sum, p) => sum + p.runnersDrivenIn, 0);
    const totalRunnersOn = players.reduce((sum, p) => sum + p.totalRunnersOn, 0);
    const conversionRate = totalRunnersOn > 0 ? ((totalRunnersDrivenIn / totalRunnersOn) * 100).toFixed(0) : '0';

    const threshold = m === 'avg' ? 0.015 : 0.02;
    const withEnoughPa = players.filter((p) => p.runnersOnPa >= 5 && p.basesEmptyStats.pa >= 5);

    const getDelta = (p: PlayerClutchSummary): number => (m === 'avg' ? calcAvg(p.runnersOnStats) - calcAvg(p.basesEmptyStats) : p.wobaDelta);

    const elevators = withEnoughPa.filter((p) => getDelta(p) > threshold).length;
    const droppers = withEnoughPa.filter((p) => getDelta(p) < -threshold).length;

    const sorted = [...withEnoughPa].sort((a, b) => getDelta(b) - getDelta(a));
    const top = sorted[0];
    const topDelta = top ? getDelta(top) : 0;
    const fmt = m === 'avg' ? formatAvgValue : formatWoba;

    return {
      totalEvents,
      totalRunnersDrivenIn,
      totalRunnersOn,
      conversionRate,
      elevators,
      droppers,
      topClutchName: top?.name ?? '-',
      topClutchDelta: top ? `+${fmt(topDelta)}` : '-',
    };
  });

  readonly selectedPlayer = computed(() => {
    const name = this.selectedPlayerName();
    const players = this.filteredPlayers();

    if (!name) {
      return null;
    }

    return players.find((p) => p.name === name) ?? null;
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scrapedAt.set(null);
    this.clutchData.set(null);
    this.selectedPlayerName.set(null);

    this.statsService.getStats(this.selectedYear()).subscribe({
      next: (stats) => {
        this.scrapedAt.set(stats.scrapedAt || null);

        const abbrevNames = this.rosterService.wellesleyRosterAbbrevNames();
        const summary = stats.clutchSummary;

        if (summary && abbrevNames.size > 0) {
          const filtered: ClutchSummary = {
            players: summary.players.filter((p) => abbrevNames.has(p.name)),
            allEvents: summary.allEvents.filter((e) => abbrevNames.has(e.batterName)),
          };
          this.clutchData.set(filtered);
        } else {
          this.clutchData.set(summary);
        }

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'An error occurred while loading clutch data');
        this.loading.set(false);
        console.error('Error loading clutch data:', err);
      },
    });
  }

  setYear(year: number): void {
    this.selectedYear.set(year);
    this.loadData();
  }

  selectPlayer(player: PlayerClutchSummary): void {
    this.selectedPlayerName.update((current) => (current === player.name ? null : player.name));
  }
}
