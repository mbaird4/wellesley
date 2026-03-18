import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SprayChartSummary, Team } from '@ws/core/models';

import { SprayField } from '../spray-field/spray-field';

export interface PrintPlayerSummary {
  name: string;
  jersey: number;
  summary: SprayChartSummary;
  bats?: 'L' | 'R' | 'S' | null;
  position?: string | null;
  avg?: number;
  woba?: number;
  pa?: number;
  sb?: number;
  sbAtt?: number;
  gp?: number;
  sh?: number;
  slg?: number;
  so?: number;
  rbi?: number;
  h?: number;
  bb?: number;
  ab?: number;
  doubles?: number;
  triples?: number;
  hr?: number;
}

interface YearSbEntry {
  year: number;
  sb: number;
  sbAtt: number;
}

interface DugoutPlayer {
  name: string;
  jersey: number;
  summary: SprayChartSummary;
  yearSbEntries: YearSbEntry[];
}

@Component({
  selector: 'ws-spray-chart-print-view',
  standalone: true,
  imports: [SprayField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block' },
  templateUrl: './spray-chart-print-view.html',
})
export class SprayChartPrintView {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly teamData = input<Team | null>(null);

  readonly dugoutPlayers = computed<DugoutPlayer[]>(() => {
    const team = this.teamData();

    return this.players().map((p) => {
      const rp = team?.players.find((tp) => tp.jerseyNumber === p.jersey) ?? null;
      const yearSbEntries: YearSbEntry[] = rp
        ? rp.seasons
            .filter((s) => s.sb > 0 || s.sbAtt > 0)
            .map((s) => ({ year: s.year, sb: s.sb, sbAtt: s.sbAtt }))
            .sort((a, b) => a.year - b.year)
        : [];

      return {
        name: p.name,
        jersey: p.jersey,
        summary: p.summary,
        yearSbEntries,
      };
    });
  });
}
