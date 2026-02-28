import { mergeBaseRunnerStats } from './base-runner-stats';
import { processPlay } from './parse-play';
import { processGameWithSnapshots } from './process-game-snapshots';
import {
  computeSacBuntOutcomes,
  computeScoringPlaySummary,
  summarizeSacBuntOutcomes,
} from './scoring-plays';
import {
  BaseRunnerRow,
  GameData,
  GameResult,
  GameScoringPlays,
  GameState,
  GameWithSnapshots,
  ResultRow,
  SacBuntOutcome,
  SacBuntSummary,
  ScoringPlay,
  ScoringPlaySummary,
} from './types';

export interface ProcessedStats {
  totals: ResultRow[];
  games: GameResult[];
}

export interface ProcessedStatsWithSnapshots {
  totals: ResultRow[];
  games: GameWithSnapshots[];
  baseRunnerStats: BaseRunnerRow[];
  seasonScoringPlays: ScoringPlaySummary;
  gameScoringPlays: GameScoringPlays[];
  sacBuntSummary: SacBuntSummary;
}

/**
 * Processes an array of games and returns PA counts by lineup slot at each out count.
 * Derives batting order from play-by-play sequence — no lineup table needed.
 * Slot = (batterIndex % 9) + 1, cycling 1-9.
 */
export function processGames(games: GameData[]): ProcessedStats {
  const globalCounts = new Map<number, [number, number, number]>();
  const gameResults: GameResult[] = [];

  for (const game of games) {
    if (game.playByPlay.length === 0) continue;

    const gameState: GameState = {
      baseRunners: { first: null, second: null, third: null },
      outs: 0,
      batterIndex: 0,
      plateAppearances: new Map(),
    };

    for (const inning of game.playByPlay) {
      gameState.outs = 0;
      gameState.baseRunners = { first: null, second: null, third: null };

      for (const playText of inning.plays) {
        processPlay(playText, gameState);
      }
    }

    // Build per-game ResultRow[]
    const gameRows = Array.from(gameState.plateAppearances.entries())
      .map(([slot, counts]) => ({
        lineupSlot: slot,
        paWith0Outs: counts[0],
        paWith1Out: counts[1],
        paWith2Outs: counts[2],
        totalPA: counts[0] + counts[1] + counts[2],
      }))
      .sort((a, b) => a.lineupSlot - b.lineupSlot);

    gameResults.push({
      url: game.url || '',
      opponent: game.opponent || 'Unknown',
      rows: gameRows,
      totalPA: gameRows.reduce((s, r) => s + r.totalPA, 0),
    });

    // Merge into global accumulator
    for (const [slot, counts] of gameState.plateAppearances) {
      const global = globalCounts.get(slot) || [0, 0, 0];
      global[0] += counts[0];
      global[1] += counts[1];
      global[2] += counts[2];
      globalCounts.set(slot, global);
    }
  }

  const totals = Array.from(globalCounts.entries())
    .map(([slot, counts]) => ({
      lineupSlot: slot,
      paWith0Outs: counts[0],
      paWith1Out: counts[1],
      paWith2Outs: counts[2],
      totalPA: counts[0] + counts[1] + counts[2],
    }))
    .sort((a, b) => a.lineupSlot - b.lineupSlot);

  return { totals, games: gameResults };
}

/**
 * Like processGames but also captures PlaySnapshot[] per game for the field visualization.
 */
export function processGamesWithSnapshots(
  games: GameData[]
): ProcessedStatsWithSnapshots {
  const globalCounts = new Map<number, [number, number, number]>();
  const gameResults: GameWithSnapshots[] = [];
  let seasonBaseRunnerStats: BaseRunnerRow[] = [];

  for (const game of games) {
    if (game.playByPlay.length === 0) continue;

    const result = processGameWithSnapshots(game);
    gameResults.push(result);

    // Merge into global accumulator
    for (const row of result.rows) {
      const global = globalCounts.get(row.lineupSlot) || [0, 0, 0];
      global[0] += row.paWith0Outs;
      global[1] += row.paWith1Out;
      global[2] += row.paWith2Outs;
      globalCounts.set(row.lineupSlot, global);
    }

    // Aggregate base-runner stats
    seasonBaseRunnerStats = mergeBaseRunnerStats(
      seasonBaseRunnerStats,
      result.baseRunnerStats
    );
  }

  const totals = Array.from(globalCounts.entries())
    .map(([slot, counts]) => ({
      lineupSlot: slot,
      paWith0Outs: counts[0],
      paWith1Out: counts[1],
      paWith2Outs: counts[2],
      totalPA: counts[0] + counts[1] + counts[2],
    }))
    .sort((a, b) => a.lineupSlot - b.lineupSlot);

  // Aggregate scoring plays across all games
  const allScoringPlays: ScoringPlay[] = [];
  const gameScoringPlays: GameScoringPlays[] = [];

  for (const game of gameResults) {
    const gamePlays: ScoringPlay[] = [];
    for (const snap of game.snapshots) {
      gamePlays.push(...snap.scoringPlays);
    }
    allScoringPlays.push(...gamePlays);
    gameScoringPlays.push({
      url: game.url,
      opponent: game.opponent,
      plays: gamePlays,
      summary: computeScoringPlaySummary(gamePlays),
    });
  }

  const seasonScoringPlays = computeScoringPlaySummary(allScoringPlays);

  // Aggregate sac bunt outcomes across all games
  const allSacBuntOutcomes: SacBuntOutcome[] = [];
  for (const game of gameResults) {
    allSacBuntOutcomes.push(
      ...computeSacBuntOutcomes(game.snapshots, game.opponent, game.url)
    );
  }
  const sacBuntSummary = summarizeSacBuntOutcomes(allSacBuntOutcomes);

  return {
    totals,
    games: gameResults,
    baseRunnerStats: seasonBaseRunnerStats,
    seasonScoringPlays,
    gameScoringPlays,
    sacBuntSummary,
  };
}
