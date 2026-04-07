export interface ResultRow {
  lineupSlot: number;
  paWith0Outs: number;
  paWith1Out: number;
  paWith2Outs: number;
  totalPA: number;
}

export interface BaseRunners {
  first: string | null;
  second: string | null;
  third: string | null;
}

export interface GameState {
  baseRunners: BaseRunners;
  outs: number;
  batterIndex: number; // persists across innings
  plateAppearances: Map<number, [number, number, number]>; // slot -> [0-out, 1-out, 2-out]
}

export interface GameData {
  url?: string; // boxscore URL for linking
  date?: string; // game date from boxscore (e.g. "3/17/2026")
  opponent?: string; // opponent name parsed from URL
  lineup: Map<number, string[]>; // slot -> array of normalized names
  playByPlay: PlayByPlayInning[];
}

export interface PlayByPlayInning {
  inning: string;
  plays: string[];
}

/** Per-game result for the debug/detail view */
export interface GameResult {
  url: string;
  opponent: string;
  rows: ResultRow[];
  totalPA: number;
}
