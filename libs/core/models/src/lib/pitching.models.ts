export interface InningsTableRow {
  inning: string;
  battersFaced: number;
  hits: number;
  runs: number;
  strikeouts: number;
  walks: number;
  formattedAvg: string;
  formattedWoba: string;
  avgStyle: Record<string, string>;
  wobaStyle: Record<string, string>;
}

export interface InningsTotalsRow {
  battersFaced: number;
  hits: number;
  runs: number;
  strikeouts: number;
  walks: number;
  formattedAvg: string;
  formattedWoba: string;
  avgStyle: Record<string, string>;
  wobaStyle: Record<string, string>;
}

export interface PitcherOverviewData {
  name: string;
  w: number;
  l: number;
  era: number;
  app: number;
  gs: number;
  ip: number;
  so: number;
  bb: number;
  h: number;
  hr: number;
}

export interface PitcherOption {
  name: string;
  label: string;
}

/** Raw pitching stats scraped from the stats page */
export interface RawPitchingStats {
  name: string;
  w: number;
  l: number;
  era: number;
  app: number;
  gs: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
}

/** Per-play record tracking which pitcher was active */
export interface PitcherTrackedPlay {
  activePitcher: string;
  inning: string;
  batterName: string | null;
  batterResult: string;
  playText: string;
  runsScored: number;
  hitsOnPlay: number;
  isPlateAppearance: boolean;
}

/** Per-pitcher, per-inning aggregation */
export interface PitcherInningStats {
  inning: string;
  battersFaced: number;
  ab: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  runs: number;
  outs: number;
  walks: number;
  strikeouts: number;
  hbp: number;
}

/** One pitcher's performance in one game */
export interface PitcherGameLog {
  date: string;
  opponent: string;
  url: string;
  pitcher: string;
  innings: PitcherInningStats[];
  totals: PitcherInningStats;
}

/** Aggregated across games with per-inning breakdown */
export interface PitcherSeasonSummary {
  pitcher: string;
  games: number;
  byInning: Map<string, PitcherInningStats>;
  totals: PitcherInningStats;
  gameLogs: PitcherGameLog[];
}
