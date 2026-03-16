import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SprayChartSummary, SprayDataPoint, SprayTrend, Team } from '@ws/core/models';
import { buildCallouts, type Callout, computeSprayZones, detectSprayTrends } from '@ws/core/processors';
import { range } from '@ws/core/util';

import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { aggregateStats, CURRENT_YEAR, SPRAY_YEARS } from '../spray-chart-viewer/spray-chart-viewer';
import { SprayField } from '../spray-field/spray-field';

const CARDS_PER_PAGE = 6;

const STAT_LABELS = ['AVG', 'SLG', 'wOBA', 'PA', 'H', '1B', '2B', '3B', 'HR', 'BB', 'K', 'RBI', 'SB'] as const;

interface YearColumn {
  year: number;
  values: string[];
}

interface CoachRow {
  name: string;
  jersey: number;
  batsLabel: string;
  posLabel: string;
  currentYearSummary: SprayChartSummary;
  careerSummary: SprayChartSummary;
  currentYearLabel: string;
  careerLabel: string;
  yearColumns: YearColumn[];
  isFirstYear: boolean;
  // Kept for future use — not currently displayed
  callouts: Callout[];
  trends: SprayTrend[];
}

function formatYearStats(stats: ReturnType<typeof aggregateStats> | null): string[] {
  if (!stats) {
    return STAT_LABELS.map(() => '—');
  }

  const fmtAvg = (v: number): string => v.toFixed(3).replace(/^0/, '');
  const singles = stats.h - stats.doubles - stats.triples - stats.hr;
  const sb = stats.sbAtt > 0 ? `${stats.sb}/${stats.sbAtt}` : stats.sb > 0 ? String(stats.sb) : '—';
  const fmtCount = (v: number): string => (v > 0 ? String(v) : '—');

  return [fmtAvg(stats.avg), fmtAvg(stats.slg), fmtAvg(stats.woba), fmtCount(stats.pa), fmtCount(stats.h), fmtCount(singles), fmtCount(stats.doubles), fmtCount(stats.triples), fmtCount(stats.hr), fmtCount(stats.bb), fmtCount(stats.so), fmtCount(stats.rbi), sb];
}

@Component({
  selector: 'ws-spray-chart-coach-print-view',
  standalone: true,
  imports: [SprayField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block' },
  templateUrl: './spray-chart-coach-print-view.html',
})
export class SprayChartCoachPrintView {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly years = input<string[]>([]);
  readonly viewMode = input<string>('combined');
  readonly dataByYear = input<Map<number, SprayDataPoint[]>>(new Map());
  readonly teamData = input<Team | null>(null);
  readonly needsPageBreak = input(false);

  readonly statLabels = STAT_LABELS;

  readonly yearsLabel = computed(() => {
    const y = this.years();

    return y.length > 0 ? `Data: ${y.join(', ')}` : '';
  });

  readonly printDate = computed(() => {
    const d = new Date();

    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  });

  readonly noteLines = range(6);

  readonly rows = computed<CoachRow[]>(() => {
    const map = this.dataByYear();
    const team = this.teamData();
    const prevYear = CURRENT_YEAR - 1;

    return this.players().map((p) => {
      // Years this player has spray data
      const playerSprayYears = SPRAY_YEARS.filter((y) => (map.get(y) ?? []).some((d) => d.playerName === p.name)).sort((a, b) => a - b);

      // RosterPlayer for batting stats
      const rp = team?.players.find((tp) => tp.jerseyNumber === p.jersey) ?? null;
      const statYears = rp ? rp.seasons.map((s) => s.year).sort((a, b) => a - b) : [];

      // Union of all years with any data
      const allYears = [...new Set([...playerSprayYears, ...statYears])].sort((a, b) => a - b);
      const isFirstYear = playerSprayYears.length <= 1;

      // Spray: current year only
      const currentYearData = (map.get(CURRENT_YEAR) ?? []).filter((d) => d.playerName === p.name);
      const currentYearSummary = computeSprayZones(currentYearData);

      // Spray: career (all years with data)
      const allData = playerSprayYears.flatMap((y) => (map.get(y) ?? []).filter((d) => d.playerName === p.name));
      const careerSummary = computeSprayZones(allData);

      // Spray chart labels
      const minYear = allYears.length > 0 ? allYears[0] : CURRENT_YEAR;
      const maxYear = allYears.length > 0 ? allYears[allYears.length - 1] : CURRENT_YEAR;
      const careerLabel = minYear === maxYear ? String(maxYear) : `${minYear}–${maxYear}`;

      // Stat columns: prev year + current year (like pitcher view)
      // First-year players get only current year
      const displayYears = isFirstYear ? [CURRENT_YEAR] : [prevYear, CURRENT_YEAR];

      const yearColumns: YearColumn[] = displayYears.map((year) => ({
        year,
        values: formatYearStats(rp ? aggregateStats(rp, [year]) : null),
      }));

      // Kept for future use — not currently displayed
      const callouts = buildCallouts(p);
      const thisYearPts = (map.get(CURRENT_YEAR) ?? []).filter((d) => d.playerName === p.name);
      const lastYearPts = (map.get(prevYear) ?? []).filter((d) => d.playerName === p.name);
      const trends = detectSprayTrends(thisYearPts, lastYearPts);

      return {
        name: p.name,
        jersey: p.jersey,
        batsLabel: p.bats ? `(${p.bats})` : '',
        posLabel: p.position ?? '',
        currentYearSummary,
        careerSummary,
        currentYearLabel: String(CURRENT_YEAR),
        careerLabel,
        yearColumns,
        isFirstYear,
        callouts,
        trends,
      };
    });
  });

  readonly pages = computed<CoachRow[][]>(() => {
    const cards = this.rows();
    const pageCount = Math.ceil(cards.length / CARDS_PER_PAGE);

    return Array.from({ length: pageCount }, (_, i) => cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  });
}
