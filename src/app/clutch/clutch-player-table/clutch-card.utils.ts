import type { ClutchEvent, PbpBattingAccum, PlayerClutchSummary } from '@ws/core/models';
import type { BattingMetric } from '@ws/core/models';
import { accumFromResult, calculateWoba, emptyAccum, formatWoba, isProductive, wobaColorStyle } from '@ws/core/processors';

export interface SituationStat {
  label: string;
  formatted: string;
  color: string;
}

export interface ContactItem {
  label: string;
  count: number;
}

export interface DisplayCard {
  player: PlayerClutchSummary;
  jersey: number | null;
  headline: string;
  robProductiveLabel: string;
  emptyProductiveLabel: string;
  emptyProductiveCount: string;
  robProductiveCount: string;
  emptyTierClass: string;
  robTierClass: string;
  deltaLabel: string;
  deltaArrow: string;
  deltaPillClass: string;
  contactBreakdown: ContactItem[];
  overallFormatted: string;
  overallColor: string;
  overallTooltip: string;
  runnerLine: string;
  robValue: number;
  situationLabel: string;
}

export function productiveRate(events: ClutchEvent[]): { rate: number; productive: number; total: number } {
  const eligible = events.filter((e) => e.batterResult !== 'error' && e.batterResult !== 'hbp');
  const productive = eligible.filter(isProductive).length;

  return { rate: eligible.length > 0 ? productive / eligible.length : 0, productive, total: eligible.length };
}

export function battingAverageFromEvents(events: ClutchEvent[]): { rate: number; hits: number; ab: number } {
  const accum = emptyAccum();
  events.forEach((e) => accumFromResult(e.batterResult, accum));

  return { rate: accum.ab > 0 ? accum.h / accum.ab : 0, hits: accum.h, ab: accum.ab };
}

export function rateTierClass(rate: number, total: number, metric: 'avg' | 'productive'): string {
  if (total === 0) {
    return 'text-content-dim';
  }

  const thresholds = metric === 'avg' ? { good: 0.3, mid: 0.225 } : { good: 0.55, mid: 0.4 };

  if (rate >= thresholds.good) {
    return 'text-emerald-400';
  }

  if (rate >= thresholds.mid) {
    return 'text-yellow-400';
  }

  return 'text-red-400';
}

const DELTA_BIG = 0.1;
const DELTA_SMALL = 0.04;

export function deltaPillClass(delta: number, robTotal: number, emptyTotal: number): string {
  if (robTotal === 0 || emptyTotal === 0) {
    return 'bg-white/5 text-content-dim';
  }

  if (delta > DELTA_SMALL) {
    return 'bg-emerald-500/15 text-emerald-400';
  }

  if (delta < -DELTA_SMALL) {
    return 'bg-red-500/15 text-red-400';
  }

  return 'bg-white/5 text-content-secondary';
}

export function deltaArrow(delta: number, robTotal: number, emptyTotal: number): string {
  if (robTotal === 0 || emptyTotal === 0) {
    return '';
  }

  if (delta > DELTA_SMALL) {
    return 'fa-arrow-up';
  }

  if (delta < -DELTA_SMALL) {
    return 'fa-arrow-down';
  }

  return 'fa-minus';
}

export function deltaLabel(delta: number, robTotal: number, emptyTotal: number, format: 'avg' | 'pct' = 'avg'): string {
  if (robTotal === 0 || emptyTotal === 0) {
    return '—';
  }

  const sign = delta >= 0 ? '+' : '-';

  if (format === 'pct') {
    return `${sign}${Math.round(Math.abs(delta) * 100)}pp`;
  }

  const formatted = Math.abs(delta).toFixed(3).replace(/^0/, '');

  return `${sign}${formatted}`;
}

export function deltaHeadline(delta: number, robTotal: number, emptyTotal: number): string {
  if (robTotal === 0) {
    return 'No PAs with runners on yet';
  }

  if (emptyTotal === 0) {
    return 'No bases-empty PAs to compare against';
  }

  const abs = Math.abs(delta);

  if (abs < DELTA_SMALL) {
    return 'Performs about the same with runners on';
  }

  const magnitude = abs >= DELTA_BIG ? 'dramatically' : 'noticeably';

  if (delta > 0) {
    return `Elevates ${magnitude} with runners on`;
  }

  return `Production drops ${magnitude} with runners on`;
}

export function eventsForSituation(p: PlayerClutchSummary, situation: string): ClutchEvent[] {
  if (situation === 'loaded') {
    return p.events.filter((e) => e.baseSituation === 'loaded');
  }

  if (situation === 'risp') {
    return p.events.filter((e) => e.baseSituation === 'second' || e.baseSituation === 'third' || e.baseSituation === 'first_second' || e.baseSituation === 'first_third' || e.baseSituation === 'second_third' || e.baseSituation === 'loaded');
  }

  return p.events;
}

export const SITUATION_LABELS: Record<string, string> = {
  'runners-on': 'Runners On',
  risp: 'RISP',
  loaded: 'Loaded',
};

export function calcAvg(stats: PbpBattingAccum): number {
  return stats.ab > 0 ? stats.h / stats.ab : 0;
}

export function formatAvg(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

/** Map AVG (0–.500) into the wOBA color scale (0–.550) */
function avgToColor(avg: number): string {
  const mapped = avg * 1.1;

  return wobaColorStyle(mapped).color;
}

export function valueColor(value: number, pa: number, metric: BattingMetric): string {
  if (pa === 0) {
    return '';
  }

  return metric === 'avg' ? avgToColor(value) : wobaColorStyle(value).color;
}

export function getValues(p: PlayerClutchSummary, metric: BattingMetric): { rob: number; empty: number; risp: number; delta: number; robPa: number; emptyPa: number; rispPa: number } {
  if (metric === 'avg') {
    const rob = calcAvg(p.runnersOnStats);
    const empty = calcAvg(p.basesEmptyStats);
    const risp = calcAvg(p.rispStats);

    return {
      rob,
      empty,
      risp,
      delta: rob - empty,
      robPa: p.runnersOnStats.ab,
      emptyPa: p.basesEmptyStats.ab,
      rispPa: p.rispStats.ab,
    };
  }

  return {
    rob: p.runnersOnWoba,
    empty: p.basesEmptyWoba,
    risp: p.rispWoba,
    delta: p.wobaDelta,
    robPa: p.runnersOnPa,
    emptyPa: p.basesEmptyStats.pa,
    rispPa: p.rispStats.pa,
  };
}

export function rispDriveIn(p: PlayerClutchSummary): { scored: number; opportunities: number; rate: number } {
  let opportunities = 0;
  let scored = 0;

  p.events.forEach((e) => {
    e.runnersOn.forEach((r) => {
      if (r.baseBefore === 'second' || r.baseBefore === 'third') {
        opportunities += 1;

        if (r.outcome === 'scored') {
          scored += 1;
        }
      }
    });
  });

  return { scored, opportunities, rate: opportunities > 0 ? scored / opportunities : 0 };
}

export function buildRunnerLine(p: PlayerClutchSummary): string {
  const parts: string[] = [];
  const advancedOrScored = p.runnersAdvanced + p.runnersDrivenIn;

  if (p.totalRunnersOn > 0) {
    parts.push(`Advanced ${advancedOrScored} of ${p.totalRunnersOn} runners`);
  }

  const risp = rispDriveIn(p);

  if (risp.opportunities > 0) {
    parts.push(`Drove in ${risp.scored} of ${risp.opportunities} in scoring position`);
  }

  if (p.runnersStranded > 0) {
    parts.push(`${p.runnersStranded} stranded`);
  }

  return parts.join(' · ');
}

export function getSituationValue(p: PlayerClutchSummary, situation: string, metric: BattingMetric): { value: number; pa: number } {
  if (situation === 'runners-on') {
    if (metric === 'avg') {
      return { value: calcAvg(p.runnersOnStats), pa: p.runnersOnStats.ab };
    }

    return { value: p.runnersOnWoba, pa: p.runnersOnPa };
  }

  if (situation === 'risp') {
    if (metric === 'avg') {
      return { value: calcAvg(p.rispStats), pa: p.rispStats.ab };
    }

    return { value: p.rispWoba, pa: p.rispStats.pa };
  }

  if (situation === 'loaded') {
    const loadedEvents = p.events.filter((e) => e.baseSituation === 'loaded');
    const accum = emptyAccum();
    loadedEvents.forEach((e) => accumFromResult(e.batterResult, accum));

    if (metric === 'avg') {
      return { value: calcAvg(accum), pa: accum.ab };
    }

    return { value: calculateWoba(accum), pa: accum.pa };
  }

  return { value: 0, pa: 0 };
}

export function formatValue(value: number, pa: number, metric: BattingMetric): string {
  if (pa === 0) {
    return '-';
  }

  return metric === 'avg' ? formatAvg(value) : formatWoba(value);
}

export function buildContactBreakdown(events: ClutchEvent[]): ContactItem[] {
  const counts: Record<string, number> = {};
  events.forEach((e) => {
    counts[e.batterResult] = (counts[e.batterResult] ?? 0) + 1;
  });

  const items: ContactItem[] = [];

  const singles = (counts['single'] ?? 0) + (counts['bunt_single'] ?? 0);
  if (singles > 0) {
    items.push({ label: '1B', count: singles });
  }

  if (counts['double']) {
    items.push({ label: '2B', count: counts['double'] });
  }

  if (counts['triple']) {
    items.push({ label: '3B', count: counts['triple'] });
  }

  if (counts['homer']) {
    items.push({ label: 'HR', count: counts['homer'] });
  }

  const bb = counts['walk'] ?? 0;
  if (bb > 0) {
    items.push({ label: 'BB', count: bb });
  }

  if (counts['hbp']) {
    items.push({ label: 'HBP', count: counts['hbp'] });
  }

  if (counts['sac_fly']) {
    items.push({ label: 'SF', count: counts['sac_fly'] });
  }

  if (counts['sac_bunt']) {
    items.push({ label: 'SAC', count: counts['sac_bunt'] });
  }

  if (counts['fielders_choice']) {
    items.push({ label: 'FC', count: counts['fielders_choice'] });
  }

  if (counts['error']) {
    items.push({ label: 'ROE', count: counts['error'] });
  }

  if (counts['reached']) {
    items.push({ label: 'ROE', count: counts['reached'] });
  }

  return items;
}
