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
const MIN_PA_FOR_CALLOUTS = 12;
const MIN_PA_FOR_RATES = 20;
const SB_THREAT_RATE = 0.3;
const BUNTER_MIN_SH = 3;
const BUNTER_RATE = 0.05;
const HIGH_SLG = 0.45;
const HIGH_K_RATE = 0.25;
const LOW_K_RATE = 0.08;
const HIGH_BB_RATE = 0.12;
const HIGH_RBI_RATE = 0.6;
const MIN_XBH = 4;

interface StatCell {
  label: string;
  value: string;
  flagged: boolean;
}

interface Callout {
  icon: string;
  text: string;
}

interface CoachRow {
  name: string;
  jersey: number;
  batsLabel: string;
  posLabel: string;
  summary: PrintPlayerSummary['summary'];
  stats: StatCell[];
  zones: ZoneRow[];
  callouts: Callout[];
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

  readonly noteLines = Array.from({ length: 6 }, (_, i) => i + 1);

  readonly rows = computed<CoachRow[]>(() =>
    this.players().map((p) => {
      const zones = this.buildZones(p);
      const stats = this.buildStats(p);
      const callouts = this.buildCallouts(p);

      return {
        name: p.name,
        jersey: p.jersey,
        batsLabel: p.bats ? `(${p.bats})` : '',
        posLabel: p.position ?? '',
        summary: p.summary,
        stats,
        zones,
        callouts,
      };
    })
  );

  private buildZones(p: PrintPlayerSummary): ZoneRow[] {
    const dataPoints = p.summary.dataPoints;

    return p.summary.zones
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
  }

  private buildStats(p: PrintPlayerSummary): StatCell[] {
    const pa = p.pa ?? 0;
    const hasRates = pa >= MIN_PA_FOR_RATES;
    const xbh = (p.doubles ?? 0) + (p.triples ?? 0) + (p.hr ?? 0);
    const kRate = pa > 0 ? (p.so ?? 0) / pa : 0;
    const bbRate = pa > 0 ? (p.bb ?? 0) / pa : 0;
    const slg = p.slg ?? 0;
    const gp = p.gp ?? 0;
    const rbiRate = gp > 0 ? (p.rbi ?? 0) / gp : 0;

    const fmtAvg = (v?: number): string =>
      v !== undefined ? v.toFixed(3).replace(/^0/, '') : '—';

    return [
      { label: 'AVG', value: fmtAvg(p.avg), flagged: false },
      {
        label: 'SLG',
        value: fmtAvg(p.slg),
        flagged: hasRates && slg >= HIGH_SLG,
      },
      { label: 'wOBA', value: fmtAvg(p.woba), flagged: false },
      { label: 'PA', value: pa > 0 ? String(pa) : '—', flagged: false },
      {
        label: 'H',
        value: p.h !== undefined ? String(p.h) : '—',
        flagged: false,
      },
      { label: 'XBH', value: String(xbh), flagged: xbh >= MIN_XBH },
      {
        label: 'BB',
        value: p.bb !== undefined ? String(p.bb) : '—',
        flagged: hasRates && bbRate >= HIGH_BB_RATE,
      },
      {
        label: 'K',
        value: p.so !== undefined ? String(p.so) : '—',
        flagged: hasRates && (kRate >= HIGH_K_RATE || kRate <= LOW_K_RATE),
      },
      {
        label: 'RBI',
        value: p.rbi !== undefined ? String(p.rbi) : '—',
        flagged: hasRates && rbiRate >= HIGH_RBI_RATE,
      },
    ];
  }

  private buildCallouts(p: PrintPlayerSummary): Callout[] {
    const pa = p.pa ?? 0;

    if (pa < MIN_PA_FOR_CALLOUTS) {
      return [];
    }

    const gp = p.gp ?? 0;
    const hasRates = pa >= MIN_PA_FOR_RATES;
    const callouts: Callout[] = [];

    // SB threat
    const sbRate = gp > 0 ? (p.sb ?? 0) / gp : 0;

    if (sbRate >= SB_THREAT_RATE && (p.sb ?? 0) > 0) {
      callouts.push({ icon: '⚡', text: `SB threat: ${p.sb} SB in ${gp} GP` });
    }

    // Bunter
    const shRate = pa > 0 ? (p.sh ?? 0) / pa : 0;

    if ((p.sh ?? 0) >= BUNTER_MIN_SH && shRate >= BUNTER_RATE) {
      callouts.push({ icon: '📋', text: `Bunter: ${p.sh} SH in ${pa} PA` });
    }

    // Power
    const slg = p.slg ?? 0;
    const xbh = (p.doubles ?? 0) + (p.triples ?? 0) + (p.hr ?? 0);

    if (hasRates && slg >= HIGH_SLG) {
      callouts.push({
        icon: '💪',
        text: `Power: ${slg.toFixed(3).replace(/^0/, '')} SLG, ${xbh} XBH`,
      });
    } else if (xbh >= MIN_XBH) {
      callouts.push({
        icon: '💪',
        text: `XB threat: ${xbh} XBH (${p.doubles}×2B ${p.triples}×3B ${p.hr}×HR)`,
      });
    }

    // High K rate
    const kRate = pa > 0 ? (p.so ?? 0) / pa : 0;

    if (hasRates && kRate >= HIGH_K_RATE) {
      callouts.push({
        icon: 'K',
        text: `Strikeout prone: ${p.so} K in ${pa} PA (${(kRate * 100).toFixed(0)}%)`,
      });
    }

    // Low K rate (tough to K)
    if (hasRates && kRate <= LOW_K_RATE) {
      callouts.push({
        icon: '🎯',
        text: `Tough to K: ${p.so} K in ${pa} PA (${(kRate * 100).toFixed(0)}%)`,
      });
    }

    // Patient / walks
    const bbRate = pa > 0 ? (p.bb ?? 0) / pa : 0;

    if (hasRates && bbRate >= HIGH_BB_RATE) {
      callouts.push({
        icon: '👁',
        text: `Patient: ${p.bb} BB in ${pa} PA (${(bbRate * 100).toFixed(0)}%)`,
      });
    }

    // Run producer
    const rbiRate = gp > 0 ? (p.rbi ?? 0) / gp : 0;

    if (hasRates && rbiRate >= HIGH_RBI_RATE) {
      callouts.push({
        icon: '🏃',
        text: `Run producer: ${p.rbi} RBI in ${gp} GP`,
      });
    }

    return callouts;
  }
}
