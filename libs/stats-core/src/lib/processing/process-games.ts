import type {
  BaseRunnerRow,
  GameData,
  GameResult,
  GameScoringPlays,
  GameState,
  GameWithSnapshots,
  ResultRow,
  SacBuntSummary,
  ScoringPlaySummary,
} from '../models';
import { processPlay } from '../parsing/parse-play';
import { mergeBaseRunnerStats } from './base-runner-stats';
import { processGameWithSnapshots } from './process-game-snapshots';
import {
  computeSacBuntOutcomes,
  computeScoringPlaySummary,
  summarizeSacBuntOutcomes,
} from './scoring-plays';

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

  games
    .filter((game) => game.playByPlay.length > 0)
    .forEach((game) => {
      const gameState: GameState = {
        baseRunners: { first: null, second: null, third: null },
        outs: 0,
        batterIndex: 0,
        plateAppearances: new Map(),
      };

      game.playByPlay.forEach((inning) => {
        gameState.outs = 0;
        gameState.baseRunners = { first: null, second: null, third: null };
        inning.plays.forEach((playText) => processPlay(playText, gameState));
      });

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
      Array.from(gameState.plateAppearances).forEach(([slot, counts]) => {
        const global = globalCounts.get(slot) || [0, 0, 0];
        global[0] += counts[0];
        global[1] += counts[1];
        global[2] += counts[2];
        globalCounts.set(slot, global);
      });
    });

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

  games
    .filter((game) => game.playByPlay.length > 0)
    .forEach((game) => {
      const result = processGameWithSnapshots(game);
      gameResults.push(result);

      // Merge into global accumulator
      result.rows.forEach((row) => {
        const global = globalCounts.get(row.lineupSlot) || [0, 0, 0];
        global[0] += row.paWith0Outs;
        global[1] += row.paWith1Out;
        global[2] += row.paWith2Outs;
        globalCounts.set(row.lineupSlot, global);
      });

      // Aggregate base-runner stats
      seasonBaseRunnerStats = mergeBaseRunnerStats(
        seasonBaseRunnerStats,
        result.baseRunnerStats
      );
    });

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
  const gameScoringPlays: GameScoringPlays[] = gameResults.map((game) => {
    const gamePlays = game.snapshots.flatMap((snap) => snap.scoringPlays);

    return {
      url: game.url,
      opponent: game.opponent,
      plays: gamePlays,
      summary: computeScoringPlaySummary(gamePlays),
    };
  });

  const allScoringPlays = gameScoringPlays.flatMap((g) => g.plays);
  const seasonScoringPlays = computeScoringPlaySummary(allScoringPlays);

  // Aggregate sac bunt outcomes across all games
  const allSacBuntOutcomes = gameResults.flatMap((game) =>
    computeSacBuntOutcomes(game.snapshots, game.opponent, game.url)
  );

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
