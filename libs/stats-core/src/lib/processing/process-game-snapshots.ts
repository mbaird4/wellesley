import type {
  BaseRunners,
  GameData,
  GameState,
  GameWithSnapshots,
  PlaySnapshot,
} from '../models';
import {
  classifyPlay,
  getPlayerNameFromText,
  processPlay,
} from '../parsing/parse-play';
import { computeBaseRunnerStats } from './base-runner-stats';
import { extractScoringPlays } from './scoring-plays';

function cloneBases(bases: BaseRunners): BaseRunners {
  return { first: bases.first, second: bases.second, third: bases.third };
}

/**
 * Processes a single game and captures a PlaySnapshot for every play event.
 * Does NOT modify processPlay — wraps it to record before/after state.
 */
export function processGameWithSnapshots(game: GameData): GameWithSnapshots {
  const snapshots: PlaySnapshot[] = [];

  if (game.playByPlay.length === 0) {
    return {
      url: game.url || '',
      opponent: game.opponent || 'Unknown',
      rows: [],
      totalPA: 0,
      snapshots: [],
      baseRunnerStats: [],
    };
  }

  const gameState: GameState = {
    baseRunners: { first: null, second: null, third: null },
    outs: 0,
    batterIndex: 0,
    plateAppearances: new Map(),
  };

  let playIndex = 0;
  const knownBatters: (string | null)[] = new Array(9).fill(null);

  game.playByPlay.forEach((inning) => {
    gameState.outs = 0;
    gameState.baseRunners = { first: null, second: null, third: null };

    inning.plays
      .filter((playText) => classifyPlay(playText) !== 'no_play')
      .forEach((playText) => {
        const basesBefore = cloneBases(gameState.baseRunners);
        const outsBefore = gameState.outs;
        const batterIndexBefore = gameState.batterIndex;

        // Current batter slot is whoever is due up (before processPlay increments)
        const currentSlot = (batterIndexBefore % 9) + 1;

        processPlay(playText, gameState);

        const playType = classifyPlay(playText);
        const isPA = playType === 'plate_appearance';
        const batterName = isPA ? getPlayerNameFromText(playText) : null;
        // If it was a PA, the batterIndex was incremented by processPlay
        const lineupSlot =
          isPA && gameState.batterIndex > batterIndexBefore
            ? (batterIndexBefore % 9) + 1
            : null;

        // Learn batter names from PAs
        if (isPA && batterName) {
          knownBatters[currentSlot - 1] = batterName;
        }

        const basesAfter = cloneBases(gameState.baseRunners);
        const outsAfter = gameState.outs;

        const scoringPlays = extractScoringPlays(
          playText,
          playType,
          basesBefore,
          basesAfter,
          outsBefore,
          outsAfter,
          inning.inning,
          batterName,
          lineupSlot
        );

        snapshots.push({
          playIndex,
          inning: inning.inning,
          playText,
          playType,
          basesBefore,
          outsBefore,
          basesAfter,
          outsAfter,
          lineupSlot,
          batterName,
          isPlateAppearance: isPA,
          currentBatterName: knownBatters[currentSlot - 1],
          currentBatterSlot: currentSlot,
          scoringPlays,
        });

        playIndex++;
      });
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

  return {
    url: game.url || '',
    opponent: game.opponent || 'Unknown',
    rows: gameRows,
    totalPA: gameRows.reduce((s, r) => s + r.totalPA, 0),
    snapshots,
    baseRunnerStats: computeBaseRunnerStats(snapshots),
  };
}
