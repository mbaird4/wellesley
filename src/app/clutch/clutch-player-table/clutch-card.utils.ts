import type { ClutchEvent, PbpBattingAccum, PlayerClutchSummary } from '@ws/core/models';
import { accumFromResult, calculateWoba, emptyAccum, formatWoba, wobaColorStyle } from '@ws/core/processors';

import type { ClutchMetric } from '../clutch-metric';

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
  headline: string;
  deltaLabel: string;
  deltaArrow: string;
  deltaPillClass: string;
  emptyFormatted: string;
  emptyColor: string;
  situationStats: SituationStat[];
  contactBreakdown: ContactItem[];
  overallFormatted: string;
  overallColor: string;
  overallTooltip: string;
  runnerLine: string;
  robValue: number;
  delta: number;
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

export function valueColor(value: number, pa: number, metric: ClutchMetric): string {
  if (pa === 0) {
    return '';
  }

  return metric === 'avg' ? avgToColor(value) : wobaColorStyle(value).color;
}

export function getValues(p: PlayerClutchSummary, metric: ClutchMetric): { rob: number; empty: number; risp: number; delta: number; robPa: number; emptyPa: number; rispPa: number } {
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

/** PA threshold for full confidence in delta. Below this, delta is scaled toward 0. */
const PA_CONFIDENCE_THRESHOLD = 15;

export function confidenceWeightedDelta(delta: number, robPa: number, emptyPa: number): number {
  const minPa = Math.min(robPa, emptyPa);

  return delta * Math.min(1, minPa / PA_CONFIDENCE_THRESHOLD);
}

const SITUATION_CONTEXT: Record<string, string> = {
  'runners-on': 'with runners on base',
  risp: 'with RISP',
  loaded: 'with bases loaded',
};

export function buildHeadline(delta: number, robPa: number, emptyPa: number, metric: ClutchMetric, situation: string): string {
  const context = SITUATION_CONTEXT[situation] ?? 'with runners on base';

  if (robPa === 0 || emptyPa === 0) {
    return 'Not enough data to compare';
  }

  const threshold = metric === 'avg' ? 0.01 : 0.015;
  const absDelta = Math.abs(delta);

  if (absDelta < threshold) {
    return `Hits about the same ${context}`;
  }

  const bigThreshold = metric === 'avg' ? 0.06 : 0.08;
  const midThreshold = metric === 'avg' ? 0.03 : 0.04;
  const magnitude = absDelta >= bigThreshold ? 'dramatically' : absDelta >= midThreshold ? 'significantly' : 'slightly';

  if (delta > 0) {
    return `Elevates ${magnitude} ${context}`;
  }

  return `Production drops ${magnitude} ${context}`;
}

export function buildRunnerLine(p: PlayerClutchSummary): string {
  const parts: string[] = [];

  if (p.runnersDrivenIn > 0) {
    parts.push(`Drove in ${p.runnersDrivenIn} of ${p.totalRunnersOn} runners`);
  }

  if (p.runnersStranded > 0) {
    parts.push(`${p.runnersStranded} stranded`);
  }

  return parts.join(' · ');
}

export function getSituationValue(p: PlayerClutchSummary, situation: string, metric: ClutchMetric): { value: number; pa: number } {
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

export function formatValue(value: number, pa: number, metric: ClutchMetric): string {
  if (pa === 0) {
    return '-';
  }

  return metric === 'avg' ? formatAvg(value) : formatWoba(value);
}

export function buildDeltaLabel(delta: number, robPa: number, emptyPa: number, metric: ClutchMetric): string {
  if (robPa === 0 || emptyPa === 0) {
    return '-';
  }

  const sign = delta >= 0 ? '+' : '';
  const formatted = metric === 'avg' ? formatAvg(Math.abs(delta)) : formatWoba(Math.abs(delta));

  return `${sign}${formatted}`;
}

export function buildDeltaPillClass(delta: number, robPa: number, emptyPa: number, metric: ClutchMetric): string {
  if (robPa === 0 || emptyPa === 0) {
    return 'bg-white/5 text-content-dim';
  }

  const threshold = metric === 'avg' ? 0.015 : 0.02;

  if (delta > threshold) {
    return 'bg-emerald-500/15 text-emerald-400';
  }

  if (delta < -threshold) {
    return 'bg-red-500/15 text-red-400';
  }

  return 'bg-white/5 text-content-secondary';
}

export function buildDeltaArrow(delta: number, robPa: number, emptyPa: number, metric: ClutchMetric): string {
  if (robPa === 0 || emptyPa === 0) {
    return '';
  }

  const threshold = metric === 'avg' ? 0.015 : 0.02;

  if (delta > threshold) {
    return 'fa-arrow-up';
  }

  if (delta < -threshold) {
    return 'fa-arrow-down';
  }

  return 'fa-minus';
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

  if (counts['reached']) {
    items.push({ label: 'ROE', count: counts['reached'] });
  }

  return items;
}
