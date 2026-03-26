// ── Pitching types (batting types live in batting-types.ts) ──

/** Raw pitching stats scraped from the stats page */
export interface PitchingStats {
  name: string;
  w: number;
  l: number;
  era: number;
  app: number;
  gs: number;
  cg: number;
  sho: number;
  sv: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  whip: number;
  doubles: number;
  triples: number;
  ab: number;
  bAvg: number;
  wp: number;
  hbp: number;
  bk: number;
  sfa: number;
  sha: number;
}

/** Per-pitcher line from the boxscore pitching table */
export interface BoxscorePitcherLine {
  name: string;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hbp: number;
  ab: number;
  bf: number;
}

/** Per-game play-by-play */
export interface GamePbP {
  year: number;
  url: string;
  date: string;
  opponent: string;
  pitchers: string[];
  battingInnings: PbPInning[];
  pitcherBoxScore?: BoxscorePitcherLine[];
}

export interface PbPInning {
  inning: string;
  plays: string[];
}

/** Top-level combined pitching data shape (merged across years) */
export interface PitchingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  pitchingStatsByYear: Record<string, PitchingStats[]>;
  games: GamePbP[];
  nameAliases?: Record<string, string>;
}

/** Per-year pitching data file shape (pitching.json / pitching-{year}.json) */
export interface YearPitchingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  pitchingStats: PitchingStats[];
  games: GamePbP[];
}
