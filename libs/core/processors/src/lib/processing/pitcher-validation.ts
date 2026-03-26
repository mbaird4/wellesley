import type { PitcherInningStats, PitcherStatDiscrepancy, PitcherValidationResult, PitchingStats } from '@ws/core/models';

type Severity = 'info' | 'warning' | 'error';

const SEVERITY_RANK: Record<Severity, number> = { info: 1, warning: 2, error: 3 };

function bumpSeverity(s: Severity): Severity {
  if (s === 'info') {
    return 'warning';
  }

  return 'error';
}

interface ComparisonField {
  label: string;
  raw: (s: PitchingStats) => number;
  computed: (c: PitcherInningStats) => number;
}

const COMPARISON_FIELDS: ComparisonField[] = [
  { label: 'Hits', raw: (s) => s.h, computed: (c) => c.hits },
  { label: 'Runs', raw: (s) => s.r, computed: (c) => c.runs },
  { label: 'Walks', raw: (s) => s.bb, computed: (c) => c.walks },
  { label: 'Strikeouts', raw: (s) => s.so, computed: (c) => c.strikeouts },
  { label: 'Home Runs', raw: (s) => s.hr, computed: (c) => c.hr },
  { label: 'HBP', raw: (s) => s.hbp, computed: (c) => c.hbp },
  { label: 'At Bats', raw: (s) => s.ab, computed: (c) => c.ab },
];

/**
 * Compare raw pitching stats (from the stats page) against computed totals
 * from play-by-play processing to surface discrepancies.
 */
export function validatePitcherStats(rawStats: PitchingStats, computedTotals: PitcherInningStats, computedGames: number): PitcherValidationResult {
  const pitcher = rawStats.name;

  if (rawStats.app === 0) {
    return { pitcher, discrepancies: [], overallSeverity: 'ok', gamesRaw: 0, gamesComputed: computedGames };
  }

  const missingFraction = Math.max(0, (rawStats.app - computedGames) / rawStats.app);
  const discrepancies: PitcherStatDiscrepancy[] = [];

  COMPARISON_FIELDS.forEach((field) => {
    const rawVal = field.raw(rawStats);
    const computedVal = field.computed(computedTotals);

    if (rawVal === 0 && computedVal === 0) {
      return;
    }

    const delta = computedVal - rawVal;

    if (delta === 0) {
      return;
    }

    const expectedDeficit = rawVal * missingFraction;
    const adjustedDelta = Math.abs(delta) - expectedDeficit;

    if (adjustedDelta <= 0) {
      return;
    }

    const pct = rawVal > 0 ? adjustedDelta / rawVal : 1;
    let severity: Severity;

    if (adjustedDelta <= 2 || pct <= 0.15) {
      severity = 'info';
    } else if (adjustedDelta <= 5 || pct <= 0.3) {
      severity = 'warning';
    } else {
      severity = 'error';
    }

    // Overshoot (computed > raw) is more suspicious — bump severity
    if (delta > 0) {
      severity = bumpSeverity(severity);
    }

    discrepancies.push({ stat: field.label, raw: rawVal, computed: computedVal, delta, severity });
  });

  let maxRank = 0;

  discrepancies.forEach((d) => {
    const rank = SEVERITY_RANK[d.severity];

    if (rank > maxRank) {
      maxRank = rank;
    }
  });

  const overallSeverity: PitcherValidationResult['overallSeverity'] = maxRank === 0 ? 'ok' : maxRank === 1 ? 'info' : maxRank === 2 ? 'warning' : 'error';

  return { pitcher, discrepancies, overallSeverity, gamesRaw: rawStats.app, gamesComputed: computedGames };
}
