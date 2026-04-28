import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import type { PlayerClutchSummary } from '@ws/core/models';
import { ExpandablePanel, SortButtons } from '@ws/core/ui';

import type { DisplayCard } from './clutch-card.utils';
import { battingAverageFromEvents, buildContactBreakdown, buildRunnerLine, calcAvg, deltaArrow, deltaHeadline, deltaLabel, deltaPillClass, eventsForSituation, productiveRate, rateTierClass, rispDriveIn, SITUATION_LABELS } from './clutch-card.utils';

type SortKey = 'delta' | 'productive' | 'drivenIn' | 'name' | 'number';
type DisplayMetric = 'avg' | 'productive';

const DEFAULT_HIDDEN_LAST_NAMES = [];

function isDefaultHidden(playerName: string): boolean {
  const lower = playerName.toLowerCase();

  return DEFAULT_HIDDEN_LAST_NAMES.some((last) => lower.includes(last));
}

@Component({
  selector: 'ws-clutch-player-table',
  standalone: true,
  imports: [
    ExpandablePanel,
    SortButtons,
  ],
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clutch-player-table.html',
})
export class ClutchPlayerTable {
  readonly players = input.required<PlayerClutchSummary[]>();
  readonly jerseyMap = input<Record<string, number>>({});
  readonly situationFilter = input('runners-on');
  readonly selectedPlayer = input<string | null>(null);
  readonly playerSelected = output<PlayerClutchSummary>();

  readonly sort = signal<SortKey>('delta');
  readonly metric = signal<DisplayMetric>('productive');
  readonly showFilter = signal(false);
  readonly excludedPlayers = linkedSignal<PlayerClutchSummary[], ReadonlySet<string>>({
    source: this.players,
    computation: (players) => new Set(players.filter((p) => isDefaultHidden(p.name)).map((p) => p.name)),
  });

  readonly playerFilterOptions = computed(() => {
    const excluded = this.excludedPlayers();
    const jerseys = this.jerseyMap();

    return [...this.players()]
      .map((p) => ({
        name: p.name,
        jersey: jerseys[p.name] ?? null,
        included: !excluded.has(p.name),
      }))
      .sort((a, b) => a.jersey - b.jersey);
  });

  togglePlayer(name: string): void {
    this.excludedPlayers.update((set) => {
      const next = new Set(set);

      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }

      return next;
    });
  }

  hidePlayer(name: string): void {
    this.excludedPlayers.update((set) => {
      const next = new Set(set);
      next.add(name);

      return next;
    });
  }

  selectAllPlayers(): void {
    this.excludedPlayers.set(new Set());
  }

  clearAllPlayers(): void {
    this.excludedPlayers.set(new Set(this.players().map((p) => p.name)));
  }

  readonly sortOptions = [
    {
      key: 'delta' as SortKey,
      label: 'Pressure Lift',
      description: 'Productive-rate with runners on minus productive-rate with bases empty. Positive = batter elevates under pressure; negative = production drops. Strips out generally-good hitters from genuinely-clutch ones.',
    },
    {
      key: 'productive' as SortKey,
      label: 'Reliability',
      description: "Share of PAs with runners on where the team's situation didn't get worse — batter reached safely, OR an out happened but a runner advanced or scored. GIDPs and any play that retires a runner count against you.",
    },
    {
      key: 'drivenIn' as SortKey,
      label: 'Driven In %',
      description: 'Of runners who started on 2nd or 3rd while she was at bat, what share she drove home. Players with no scoring-position opportunities sort last.',
    },
    { key: 'name' as SortKey, label: 'Name' },
    { key: 'number' as SortKey, label: 'Jersey #' },
  ];

  readonly cards = computed<DisplayCard[]>(() => {
    const excluded = this.excludedPlayers();
    const players = this.players().filter((p) => !excluded.has(p.name));
    const key = this.sort();
    const situation = this.situationFilter();
    const jerseys = this.jerseyMap();
    const metric = this.metric();

    const withValues = players.map((p) => {
      const situationEvents = eventsForSituation(p, situation);

      let robRate: number;
      let robTotal: number;
      let robCount: string;
      let emptyRate: number;
      let emptyTotal: number;
      let emptyCount: string;

      if (metric === 'avg') {
        const robBa = battingAverageFromEvents(situationEvents);
        const emptyBa = { rate: p.basesEmptyStats.ab > 0 ? p.basesEmptyStats.h / p.basesEmptyStats.ab : 0, hits: p.basesEmptyStats.h, ab: p.basesEmptyStats.ab };
        robRate = robBa.rate;
        robTotal = robBa.ab;
        robCount = robBa.ab > 0 ? `${robBa.hits} / ${robBa.ab} AB` : 'no AB';
        emptyRate = emptyBa.rate;
        emptyTotal = emptyBa.ab;
        emptyCount = emptyBa.ab > 0 ? `${emptyBa.hits} / ${emptyBa.ab} AB` : 'no AB';
      } else {
        const robProd = productiveRate(situationEvents);
        robRate = robProd.rate;
        robTotal = robProd.total;
        robCount = robProd.total > 0 ? `${robProd.productive} / ${robProd.total}` : 'no PAs';
        emptyTotal = p.basesEmptyTotal;
        emptyRate = emptyTotal > 0 ? p.basesEmptyProductive / emptyTotal : 0;
        emptyCount = emptyTotal > 0 ? `${p.basesEmptyProductive} / ${emptyTotal}` : 'no PAs';
      }

      const delta = robRate - emptyRate;

      return { player: p, robRate, robTotal, robCount, emptyRate, emptyTotal, emptyCount, delta };
    });

    const compareDriveIn = (a: PlayerClutchSummary, b: PlayerClutchSummary): number => {
      const aRisp = rispDriveIn(a);
      const bRisp = rispDriveIn(b);

      if (aRisp.opportunities === 0 && bRisp.opportunities === 0) {
        return 0;
      }

      if (aRisp.opportunities === 0) {
        return 1;
      }

      if (bRisp.opportunities === 0) {
        return -1;
      }

      return bRisp.rate - aRisp.rate;
    };

    withValues.sort((a, b) => {
      switch (key) {
        case 'delta':
          return b.delta - a.delta;
        case 'productive':
          return b.robRate - a.robRate;
        case 'drivenIn':
          return compareDriveIn(a.player, b.player);
        case 'name':
          return a.player.name.localeCompare(b.player.name);
        case 'number':
          return jerseys[a.player.name] - jerseys[b.player.name];
        default:
          return 0;
      }
    });

    return withValues.map(({ player: p, robRate, robTotal, robCount, emptyRate, emptyTotal, emptyCount, delta }) => {
      const formatRate = (rate: number, total: number): string => {
        if (total === 0) {
          return '—';
        }

        if (metric === 'productive') {
          return `${Math.round(rate * 100)}%`;
        }

        return rate.toFixed(3).replace(/^0/, '');
      };

      const overallRate = metric === 'avg' ? calcAvg(p.overallStats) : p.overallProductiveTotal > 0 ? p.overallProductive / p.overallProductiveTotal : 0;
      const overallTotal = metric === 'avg' ? p.overallStats.ab : p.overallProductiveTotal;

      return {
        player: p,
        jersey: jerseys[p.name] ?? null,
        headline: deltaHeadline(delta, robTotal, emptyTotal),
        robProductiveLabel: formatRate(robRate, robTotal),
        emptyProductiveLabel: formatRate(emptyRate, emptyTotal),
        robProductiveCount: robCount,
        emptyProductiveCount: emptyCount,
        deltaLabel: deltaLabel(delta, robTotal, emptyTotal, metric === 'productive' ? 'pct' : 'avg'),
        deltaArrow: deltaArrow(delta, robTotal, emptyTotal),
        deltaPillClass: deltaPillClass(delta, robTotal, emptyTotal),
        emptyTierClass: rateTierClass(emptyRate, emptyTotal, metric),
        robTierClass: rateTierClass(robRate, robTotal, metric),
        contactBreakdown: buildContactBreakdown(p.events),
        overallFormatted: formatRate(overallRate, overallTotal),
        overallColor: '',
        overallTooltip: metric === 'avg' ? 'Season batting average (all situations)' : 'Season productive-AB rate (all situations)',
        runnerLine: buildRunnerLine(p),
        robValue: robRate,
        situationLabel: SITUATION_LABELS[situation] ?? situation,
      };
    });
  });
}
