import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { BatterVsStats } from '@ws/core/models';
import { BreakpointService } from '@ws/core/util';

interface DisplayRow {
  name: string;
  jersey: number | null;
  pa: number;
  avg: string;
  obp: string;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  walks: number;
  hbp: number;
  reached: number;
  strikeouts: number;
  groundouts: number;
  flyouts: number;
  lineouts: number;
  popups: number;
  doublePlays: number;
  sacFlies: number;
  sacBunts: number;
  hits: number;
  outs: number;
  isTotals: boolean;
}

const REACHING_COLS: { key: keyof DisplayRow; label: string }[] = [
  { key: 'singles', label: '1B' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'hr', label: 'HR' },
  { key: 'walks', label: 'BB' },
  { key: 'hbp', label: 'HBP' },
];

const OUT_COLS: { key: keyof DisplayRow; label: string }[] = [
  { key: 'strikeouts', label: 'K' },
  { key: 'groundouts', label: 'GO' },
  { key: 'flyouts', label: 'FO' },
  { key: 'lineouts', label: 'LO' },
  { key: 'popups', label: 'PU' },
];

const MISC_COLS: { key: keyof DisplayRow; label: string }[] = [
  { key: 'doublePlays', label: 'DP' },
  { key: 'sacFlies', label: 'SF' },
  { key: 'sacBunts', label: 'SH' },
];

function fmtAvg(num: number, den: number): string {
  if (den === 0) {
    return '—';
  }

  return (num / den).toFixed(3).replace(/^0/, '');
}

function toDisplayRow(b: BatterVsStats, isTotals: boolean, jersey: number | null): DisplayRow {
  const hits = b.singles + b.doubles + b.triples + b.hr;
  const ab = b.totalPA - b.walks - b.hbp - b.sacFlies - b.sacBunts;
  const onBase = hits + b.walks + b.hbp;
  const outs = b.strikeouts + b.groundouts + b.flyouts + b.lineouts + b.popups + b.foulouts + b.otherouts;

  return {
    name: b.batterName,
    jersey,
    pa: b.totalPA,
    avg: fmtAvg(hits, ab),
    obp: fmtAvg(onBase, b.totalPA - b.sacBunts),
    singles: b.singles,
    doubles: b.doubles,
    triples: b.triples,
    hr: b.hr,
    walks: b.walks,
    hbp: b.hbp,
    reached: b.reached,
    strikeouts: b.strikeouts,
    groundouts: b.groundouts,
    flyouts: b.flyouts,
    lineouts: b.lineouts,
    popups: b.popups,
    doublePlays: b.doublePlays,
    sacFlies: b.sacFlies,
    sacBunts: b.sacBunts,
    hits,
    outs,
    isTotals,
  };
}

@Component({
  selector: 'ws-vs-wellesley-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vs-wellesley-table.html',
})
export class VsWellesleyTable {
  readonly bp = inject(BreakpointService);
  readonly stats = input.required<BatterVsStats[]>();
  readonly jerseyMap = input<Record<string, number>>({});

  readonly reachingCols = REACHING_COLS;
  readonly outCols = OUT_COLS;
  readonly miscCols = MISC_COLS;

  readonly rows = computed<DisplayRow[]>(() => {
    const jm = this.jerseyMap();

    return this.stats()
      .map((b) => toDisplayRow(b, false, jm[b.batterName] ?? null))
      .sort((a, b) => (a.jersey ?? Infinity) - (b.jersey ?? Infinity));
  });

  readonly totals = computed<DisplayRow | null>(() => {
    const rows = this.stats();

    if (rows.length === 0) {
      return null;
    }

    const sum = rows.reduce<BatterVsStats>(
      (acc, row) => ({
        batterName: 'Totals',
        singles: acc.singles + row.singles,
        doubles: acc.doubles + row.doubles,
        triples: acc.triples + row.triples,
        hr: acc.hr + row.hr,
        walks: acc.walks + row.walks,
        hbp: acc.hbp + row.hbp,
        reached: acc.reached + row.reached,
        strikeouts: acc.strikeouts + row.strikeouts,
        groundouts: acc.groundouts + row.groundouts,
        flyouts: acc.flyouts + row.flyouts,
        lineouts: acc.lineouts + row.lineouts,
        popups: acc.popups + row.popups,
        foulouts: acc.foulouts + row.foulouts,
        otherouts: acc.otherouts + row.otherouts,
        doublePlays: acc.doublePlays + row.doublePlays,
        sacBunts: acc.sacBunts + row.sacBunts,
        sacFlies: acc.sacFlies + row.sacFlies,
        totalPA: acc.totalPA + row.totalPA,
      }),
      {
        batterName: 'Totals',
        singles: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        walks: 0,
        hbp: 0,
        reached: 0,
        strikeouts: 0,
        groundouts: 0,
        flyouts: 0,
        lineouts: 0,
        popups: 0,
        foulouts: 0,
        otherouts: 0,
        doublePlays: 0,
        sacBunts: 0,
        sacFlies: 0,
        totalPA: 0,
      }
    );

    return toDisplayRow(sum, true, null);
  });
}
