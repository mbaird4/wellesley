import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { SprayZone } from '@ws/core/models';
import { getContactQuality } from '@ws/core/processors';

import type { PrintPlayerSummary } from '../spray-chart-print-view/spray-chart-print-view';
import { SprayField } from '../spray-field/spray-field';

const ZONE_LABELS: Record<SprayZone, string> = {
  rf_line: 'RF Line',
  rf: 'RF',
  rf_cf: 'RF-CF',
  cf: 'CF',
  lf_cf: 'LF-CF',
  lf: 'LF',
  lf_line: 'LF Line',
  if_3b: '3B',
  if_ss: 'SS',
  if_2b: '2B',
  if_1b: '1B',
  if_p: 'P',
  if_c: 'C',
  plate_3b: '3B',
  plate_p: 'P',
  plate_1b: '1B',
};

const MIN_ZONE_BALLS = 3;
const SB_THREAT_RATE = 0.3;
const BUNTER_MIN_SH = 3;
const BUNTER_RATE = 0.05;

interface CoachRow {
  name: string;
  jersey: number;
  batsLabel: string;
  posLabel: string;
  avgLabel: string;
  wobaLabel: string;
  paLabel: string;
  summary: PrintPlayerSummary['summary'];
  zones: ZoneRow[];
  sbCallout: string | null;
  buntCallout: string | null;
}

interface ZoneRow {
  label: string;
  total: number;
  hits: number;
  outs: number;
  hard: number;
  weak: number;
  avg: string;
  pct: string;
}

@Component({
  selector: 'ws-spray-chart-coach-print-view',
  standalone: true,
  imports: [SprayField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hidden print:block break-before-page' },
  templateUrl: './spray-chart-coach-print-view.html',
})
export class SprayChartCoachPrintView {
  readonly players = input.required<PrintPlayerSummary[]>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly years = input<string[]>([]);

  readonly yearsLabel = computed(() => {
    const y = this.years();

    return y.length > 0 ? `Data: ${y.join(', ')}` : '';
  });

  readonly printDate = computed(() => {
    const d = new Date();

    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  });

  readonly rows = computed<CoachRow[]>(() =>
    this.players().map((p) => {
      const dataPoints = p.summary.dataPoints;

      const zones = p.summary.zones
        .filter((z) => z.total >= MIN_ZONE_BALLS)
        .sort((a, b) => b.total - a.total)
        .map((z) => {
          const zonePoints = dataPoints.filter((dp) => dp.zone === z.zone);
          const hard = zonePoints.filter(
            (dp) => getContactQuality(dp.contactType) === 'hard'
          ).length;

          return {
            label: ZONE_LABELS[z.zone],
            total: z.total,
            hits: z.hits,
            outs: z.outs + z.errors,
            hard,
            weak: z.total - hard,
            avg: z.battingAvg.toFixed(3).replace(/^0/, ''),
            pct: `${(z.pct * 100).toFixed(0)}%`,
          };
        });

      const sbRate = p.gp !== undefined && p.gp > 0 ? (p.sb ?? 0) / p.gp : 0;
      const shRate = p.pa !== undefined && p.pa > 0 ? (p.sh ?? 0) / p.pa : 0;

      return {
        name: p.name,
        jersey: p.jersey,
        batsLabel: p.bats ? `(${p.bats})` : '',
        posLabel: p.position ?? '',
        avgLabel:
          p.avg !== undefined ? p.avg.toFixed(3).replace(/^0/, '') : '—',
        wobaLabel:
          p.woba !== undefined ? p.woba.toFixed(3).replace(/^0/, '') : '—',
        paLabel: p.pa !== undefined ? String(p.pa) : '—',
        summary: p.summary,
        zones,
        sbCallout:
          sbRate >= SB_THREAT_RATE && (p.sb ?? 0) > 0
            ? `SB threat: ${p.sb} SB in ${p.gp} GP`
            : null,
        buntCallout:
          (p.sh ?? 0) >= BUNTER_MIN_SH && shRate >= BUNTER_RATE
            ? `Bunter: ${p.sh} SH in ${p.pa} PA`
            : null,
      };
    })
  );
}
