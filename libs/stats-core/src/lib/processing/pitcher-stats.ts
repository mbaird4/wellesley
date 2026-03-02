import type {
  PitcherGameLog,
  PitcherInningStats,
  PitcherSeasonSummary,
  PitcherTrackedPlay,
} from '../models';

/** Parse inning string to sortable number: "1st"→1, "2nd"→2, "3rd"→3, "4th"→4, etc. */
export function inningToNumber(inning: string): number {
  const match = inning.match(/^(\d+)/);

  return match ? parseInt(match[1], 10) : 0;
}

/** Create an empty inning stats object */
function emptyInningStats(inning: string): PitcherInningStats {
  return {
    inning,
    battersFaced: 0,
    ab: 0,
    hits: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    runs: 0,
    outs: 0,
    walks: 0,
    strikeouts: 0,
    hbp: 0,
  };
}

/** Classify a batter result into counting stat categories */
function accumulateResult(
  stats: PitcherInningStats,
  play: PitcherTrackedPlay
): void {
  if (!play.isPlateAppearance) {
    // Non-PA events (wild pitch, stolen base) can still score runs
    stats.runs += play.runsScored;

    return;
  }

  stats.battersFaced += 1;
  stats.runs += play.runsScored;
  stats.hits += play.hitsOnPlay;

  const result = play.batterResult;

  switch (result) {
    case 'single':
    case 'bunt_single':
      stats.singles += 1;
      stats.ab += 1;
      break;
    case 'double':
      stats.doubles += 1;
      stats.ab += 1;
      break;
    case 'triple':
      stats.triples += 1;
      stats.ab += 1;
      break;
    case 'homer':
      stats.hr += 1;
      stats.ab += 1;
      break;
    case 'walk':
      stats.walks += 1;
      break;
    case 'hbp':
      stats.hbp += 1;
      break;
    case 'out':
      stats.outs += 1;
      stats.ab += 1;

      if (play.playText.toLowerCase().includes('struck out')) {
        stats.strikeouts += 1;
      }

      break;
    case 'double_play':
      stats.outs += 2;
      stats.ab += 1;
      break;
    case 'sac_bunt':
      stats.outs += 1;
      // Sac bunt is not an AB
      break;
    case 'sac_fly':
      stats.outs += 1;
      // Sac fly is not an AB
      break;
    case 'reached':
      stats.ab += 1;
      break;
    case 'unknown':
      stats.ab += 1;
      break;
  }
}

/** Merge two inning stats objects (used for cross-game aggregation) */
function mergeInningStats(
  target: PitcherInningStats,
  source: PitcherInningStats
): void {
  target.battersFaced += source.battersFaced;
  target.ab += source.ab;
  target.hits += source.hits;
  target.singles += source.singles;
  target.doubles += source.doubles;
  target.triples += source.triples;
  target.hr += source.hr;
  target.runs += source.runs;
  target.outs += source.outs;
  target.walks += source.walks;
  target.strikeouts += source.strikeouts;
  target.hbp += source.hbp;
}

/**
 * Group tracked plays by pitcher and inning, producing per-inning stats.
 */
export function computePitcherInningStats(
  plays: PitcherTrackedPlay[]
): Map<string, PitcherInningStats[]> {
  // Group by pitcher → inning
  const byPitcher = new Map<string, Map<string, PitcherInningStats>>();

  plays.forEach((play) => {
    if (!byPitcher.has(play.activePitcher)) {
      byPitcher.set(play.activePitcher, new Map());
    }

    const pitcherMap = byPitcher.get(play.activePitcher) ?? new Map();

    if (!pitcherMap.has(play.inning)) {
      pitcherMap.set(play.inning, emptyInningStats(play.inning));
    }

    const stats = pitcherMap.get(play.inning) ?? emptyInningStats(play.inning);
    accumulateResult(stats, play);
  });

  // Convert to sorted arrays
  const result = new Map<string, PitcherInningStats[]>();

  byPitcher.forEach((inningMap, pitcher) => {
    const innings = Array.from(inningMap.values()).sort(
      (a, b) => inningToNumber(a.inning) - inningToNumber(b.inning)
    );
    result.set(pitcher, innings);
  });

  return result;
}

/** Sum an array of inning stats into a single totals row */
function sumInnings(innings: PitcherInningStats[]): PitcherInningStats {
  const totals = emptyInningStats('Total');

  innings.forEach((inn) => mergeInningStats(totals, inn));

  return totals;
}

/**
 * Compute a single-game pitcher log from tracked plays.
 */
export function computePitcherGameLog(
  plays: PitcherTrackedPlay[],
  gameInfo: { date: string; opponent: string; url: string }
): PitcherGameLog[] {
  const byPitcher = computePitcherInningStats(plays);
  const logs: PitcherGameLog[] = [];

  byPitcher.forEach((innings, pitcher) => {
    logs.push({
      date: gameInfo.date,
      opponent: gameInfo.opponent,
      url: gameInfo.url,
      pitcher,
      innings,
      totals: sumInnings(innings),
    });
  });

  return logs;
}

/**
 * Aggregate multiple game logs into a season summary per pitcher.
 */
export function computePitcherSeasonSummary(
  gameLogs: PitcherGameLog[]
): PitcherSeasonSummary[] {
  const byPitcher = new Map<string, PitcherGameLog[]>();

  gameLogs.forEach((log) => {
    if (!byPitcher.has(log.pitcher)) {
      byPitcher.set(log.pitcher, []);
    }

    const logs = byPitcher.get(log.pitcher) ?? [];
    logs.push(log);
  });

  const summaries: PitcherSeasonSummary[] = [];

  byPitcher.forEach((logs, pitcher) => {
    const byInning = new Map<string, PitcherInningStats>();

    logs.forEach((log) => {
      log.innings.forEach((inn) => {
        if (!byInning.has(inn.inning)) {
          byInning.set(inn.inning, emptyInningStats(inn.inning));
        }

        const existing = byInning.get(inn.inning) ?? emptyInningStats(inn.inning);
        mergeInningStats(existing, inn);
      });
    });

    const allInnings = Array.from(byInning.values()).sort(
      (a, b) => inningToNumber(a.inning) - inningToNumber(b.inning)
    );

    summaries.push({
      pitcher,
      games: logs.length,
      byInning,
      totals: sumInnings(allInnings),
      gameLogs: logs,
    });
  });

  // Sort by games pitched descending (starters first)
  summaries.sort((a, b) => b.games - a.games);

  return summaries;
}

/**
 * Compute batting average against: hits / AB.
 * Returns 0 if AB is 0.
 */
export function battingAvgAgainst(stats: PitcherInningStats): number {
  if (stats.ab === 0) {
    return 0;
  }

  return stats.hits / stats.ab;
}

/**
 * Compute wOBA against from pitcher inning stats.
 * Uses the same linear weights as the batting wOBA calculation.
 */
export function wobaAgainst(stats: PitcherInningStats): number {
  const denominator = stats.ab + stats.walks + stats.hbp;

  if (denominator === 0) {
    return 0;
  }

  const numerator =
    0.5 * stats.walks +
    0.5 * stats.hbp +
    0.9 * stats.singles +
    1.2 * stats.doubles +
    1.7 * stats.triples +
    2.5 * stats.hr;

  return numerator / denominator;
}
