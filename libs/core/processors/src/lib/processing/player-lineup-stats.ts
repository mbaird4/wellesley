import type { GameWithSnapshots, PbpBattingAccum, PlayerLineupBreakdown, PlayerSlotStats } from '@ws/core/models';

import { parseBatterAction } from '../parsing/parse-play';
import { calculateWoba } from '../woba/woba';
import { accumFromResult, emptyAccum } from './clutch-stats';

/**
 * Computes per-player batting stats broken down by lineup position (1-9).
 * Iterates all PA snapshots, accumulates stats per player per slot,
 * and returns sorted by total PAs descending.
 */
export function computePlayerLineupStats(games: GameWithSnapshots[]): PlayerLineupBreakdown[] {
  const playerMap = new Map<
    string,
    {
      bySlot: Map<number, { accum: PbpBattingAccum; rbi: number }>;
      overall: { accum: PbpBattingAccum; rbi: number };
    }
  >();

  games
    .flatMap((game) => game.snapshots)
    .filter((snap) => snap.isPlateAppearance && snap.batterName !== null && snap.lineupSlot !== null)
    .forEach((snap) => {
      const name = snap.batterName!;
      const slot = snap.lineupSlot!;

      const subEvents = snap.playText
        .replace(/\.$/, '')
        .split(';')
        .map((s) => s.trim());
      const result = parseBatterAction(subEvents[0]).result;
      const rbi = snap.scoringPlays.length;

      if (!playerMap.has(name)) {
        playerMap.set(name, {
          bySlot: new Map(),
          overall: { accum: emptyAccum(), rbi: 0 },
        });
      }

      const player = playerMap.get(name)!;

      accumFromResult(result, player.overall.accum);
      player.overall.rbi += rbi;

      if (!player.bySlot.has(slot)) {
        player.bySlot.set(slot, { accum: emptyAccum(), rbi: 0 });
      }

      const slotData = player.bySlot.get(slot)!;
      accumFromResult(result, slotData.accum);
      slotData.rbi += rbi;
    });

  return Array.from(playerMap.entries())
    .map(([name, data]) => {
      const overallWoba = calculateWoba(data.overall.accum);
      const overallAvg = data.overall.accum.ab > 0 ? data.overall.accum.h / data.overall.accum.ab : 0;

      const bySlot: (PlayerSlotStats | null)[] = Array.from({ length: 9 }, (_, i) => {
        const slotData = data.bySlot.get(i + 1);

        if (!slotData) {
          return null;
        }

        return {
          stats: slotData.accum,
          woba: calculateWoba(slotData.accum),
          avg: slotData.accum.ab > 0 ? slotData.accum.h / slotData.accum.ab : 0,
          rbi: slotData.rbi,
        };
      });

      return {
        name,
        overallStats: data.overall.accum,
        overallWoba,
        overallAvg,
        totalRbi: data.overall.rbi,
        totalPa: data.overall.accum.pa,
        bySlot,
      };
    })
    .sort((a, b) => b.totalPa - a.totalPa);
}
