import type { PbpBattingAccum } from './clutch.models';

/** Stats for a single player at a single lineup position */
export interface PlayerSlotStats {
  stats: PbpBattingAccum;
  woba: number;
  avg: number;
  rbi: number;
}

/** Per-player breakdown of performance by batting order position */
export interface PlayerLineupBreakdown {
  name: string;
  overallStats: PbpBattingAccum;
  overallWoba: number;
  overallAvg: number;
  totalRbi: number;
  totalPa: number;
  /** Index 0 = slot 1, index 8 = slot 9. null if player never batted in that slot. */
  bySlot: (PlayerSlotStats | null)[];
}
