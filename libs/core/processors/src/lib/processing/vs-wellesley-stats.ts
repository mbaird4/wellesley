import type { BatterVsStats, GamePbP, OutType, VsWellesleyData } from '@ws/core/models';

import { trackPitcherPerformance } from './pitcher-tracking';

/** Classify an out into a granular type from the play text */
function classifyOutType(playText: string): OutType {
  const text = playText.toLowerCase();

  if (text.includes('struck out')) {
    return 'strikeout';
  }

  if (text.includes('grounded out')) {
    return 'groundout';
  }

  if (text.includes('flied out')) {
    return 'flyout';
  }

  if (text.includes('lined out')) {
    return 'lineout';
  }

  if (text.includes('popped up') || text.includes('popped out') || text.includes('infield fly')) {
    return 'popup';
  }

  if (text.includes('fouled out')) {
    return 'foulout';
  }

  // Safest default for unrecognized out patterns
  return 'groundout';
}

/** Create empty batter stats for a given name */
function emptyBatterStats(batterName: string): BatterVsStats {
  return {
    batterName,
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
    doublePlays: 0,
    sacBunts: 0,
    sacFlies: 0,
    totalPA: 0,
  };
}

/** Accumulate a tracked play result into batter stats */
function accumulatePlay(stats: BatterVsStats, result: string, playText: string): void {
  stats.totalPA += 1;

  switch (result) {
    case 'single':
    case 'bunt_single':
      stats.singles += 1;
      break;
    case 'double':
      stats.doubles += 1;
      break;
    case 'triple':
      stats.triples += 1;
      break;
    case 'homer':
      stats.hr += 1;
      break;
    case 'walk':
      stats.walks += 1;
      break;
    case 'hbp':
      stats.hbp += 1;
      break;
    case 'reached':
      stats.reached += 1;
      break;
    case 'out': {
      const outType = classifyOutType(playText);
      stats[`${outType}s`] += 1;
      break;
    }

    case 'double_play':
      stats.doublePlays += 1;
      stats.groundouts += 1; // DPs are typically groundouts
      break;
    case 'sac_bunt':
      stats.sacBunts += 1;
      break;
    case 'sac_fly':
      stats.sacFlies += 1;
      break;
    // 'unknown' falls through — just counted as a PA
  }
}

/**
 * Compute vs-Wellesley stats from pitching play-by-play data.
 *
 * Filters games to matching opponent names (case-insensitive, trimmed),
 * then walks each plate appearance and accumulates batter stats overall
 * and broken down by Wellesley pitcher.
 */
export function computeVsWellesleyStats(games: GamePbP[], opponentNames: string[]): VsWellesleyData {
  const normalizedNames = opponentNames.map((n) => n.trim().toLowerCase());

  const matchingGames = games.filter((g) => normalizedNames.includes(g.opponent.trim().toLowerCase()));

  const gameInfo = matchingGames.map((g) => ({ date: g.date, url: g.url, year: g.year }));

  const overallMap = new Map<string, BatterVsStats>();
  const byPitcherMap = new Map<string, Map<string, BatterVsStats>>();
  const pitcherSet = new Set<string>();

  matchingGames.forEach((game) => {
    const tracked = trackPitcherPerformance(game.battingInnings, game.pitchers);

    tracked
      .filter((play) => play.isPlateAppearance && play.batterName)
      .forEach((play) => {
        const name = play.batterName!;
        const pitcher = play.activePitcher;
        pitcherSet.add(pitcher);

        // Overall stats
        if (!overallMap.has(name)) {
          overallMap.set(name, emptyBatterStats(name));
        }

        accumulatePlay(overallMap.get(name)!, play.batterResult, play.playText);

        // By-pitcher stats
        if (!byPitcherMap.has(pitcher)) {
          byPitcherMap.set(pitcher, new Map());
        }

        const pitcherBatters = byPitcherMap.get(pitcher)!;

        if (!pitcherBatters.has(name)) {
          pitcherBatters.set(name, emptyBatterStats(name));
        }

        accumulatePlay(pitcherBatters.get(name)!, play.batterResult, play.playText);
      });
  });

  // Sort batters by totalPA descending
  const sortByPA = (a: BatterVsStats, b: BatterVsStats) => b.totalPA - a.totalPA;

  const overall = Array.from(overallMap.values()).sort(sortByPA);

  const byPitcher: Record<string, BatterVsStats[]> = {};
  byPitcherMap.forEach((batters, pitcher) => {
    byPitcher[pitcher] = Array.from(batters.values()).sort(sortByPA);
  });

  return {
    games: gameInfo,
    wellesleyPitchers: Array.from(pitcherSet),
    overall,
    byPitcher,
  };
}
