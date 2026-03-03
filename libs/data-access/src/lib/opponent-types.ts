export interface TeamEntry {
  slug: string;
  name: string;
}

export type SortKey = 'name' | 'career';
export type SortDir = 'asc' | 'desc';

export interface OpponentTeam {
  slug: string;
  domain: string;
  scrapedAt: string;
  players: OpponentPlayer[];
  teamGamesByYear?: Record<string, number>;
}

export interface OpponentPlayer {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  seasons: OpponentSeasonStats[];
  career: OpponentCareerStats;
}

export type BatHand = 'L' | 'R' | 'S';

export interface OpponentRosterEntry {
  jersey: number;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  throws: 'L' | 'R' | null;
}

export type OpponentRoster = Record<string, OpponentRosterEntry>;

export interface PlayerHandedness {
  name: string;
  bats: BatHand;
}

/** Raw pitching stats scraped from the stats page */
export interface OpponentPitchingStats {
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

/** Per-game play-by-play for an opponent */
export interface OpponentGamePbP {
  year: number;
  url: string;
  date: string;
  opponent: string;
  pitchers: string[];
  battingInnings: OpponentPbPInning[];
}

export interface OpponentPbPInning {
  inning: string;
  plays: string[];
}

/** Top-level JSON shape for opponent pitching data */
export interface OpponentPitchingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  pitchingStatsByYear: Record<string, OpponentPitchingStats[]>;
  games: OpponentGamePbP[];
}

export interface OpponentSeasonStats {
  year: number;
  name: string;
  avg: number;
  ops: number;
  gp: number;
  gs: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  tb: number;
  slg: number;
  bb: number;
  hbp: number;
  so: number;
  gdp: number;
  obp: number;
  sf: number;
  sh: number;
  sb: number;
  sbAtt: number;
  woba: number;
  pa: number;
}

export interface OpponentCareerStats {
  avg: number;
  ops: number;
  gp: number;
  gs: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  tb: number;
  slg: number;
  bb: number;
  hbp: number;
  so: number;
  gdp: number;
  obp: number;
  sf: number;
  sh: number;
  sb: number;
  sbAtt: number;
  woba: number;
  pa: number;
}

/** Per-year batting data file shape (batting-stats.json / batting-stats-{year}.json) */
export interface OpponentYearBattingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  teamGames: number;
  players: OpponentYearPlayer[];
}

export interface OpponentYearPlayer {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  season: OpponentSeasonStats;
}

/** Per-year pitching data file shape (pitching.json / pitching-{year}.json) */
export interface OpponentYearPitchingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  pitchingStats: OpponentPitchingStats[];
  games: OpponentGamePbP[];
}

export interface CumulativeEntry {
  year: number;
  woba: number;
  pa: number;
}

export interface YearData {
  season: OpponentSeasonStats;
  cumulative: { woba: number; pa: number };
  cumulativeLabel: string;
}

export type PlayerTier = 'regular' | 'reserve';

export interface OpponentDisplayRow {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  seasons: OpponentSeasonStats[];
  cumulativeByYear: CumulativeEntry[];
  yearData: Map<number, YearData>;
  career: OpponentCareerStats;
  tier: PlayerTier;
  paPerGame: number;
}
