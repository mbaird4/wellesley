// ── Shared batting types (used by both Wellesley and opponent data) ──

export interface TeamEntry {
  slug: string;
  name: string;
  group?: string;
  dataPath?: string;
}

export type SortKey = 'name' | 'career';
export type SortDir = 'asc' | 'desc';
export type BatHand = 'L' | 'R' | 'S';
export type PlayerTier = 'regular' | 'reserve';

// ── Roster ──

export interface RosterEntry {
  jersey: number;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  throws: 'L' | 'R' | null;
}

export type Roster = Record<string, RosterEntry>;

/** Simple name → jersey number map (derived from Roster for legacy consumers) */
export type JerseyMap = Record<string, number>;

/** Extract a JerseyMap from a full Roster */
export function toJerseyMap(roster: Roster): JerseyMap {
  const map: JerseyMap = {};

  Object.entries(roster).forEach(([key, entry]) => {
    map[key] = entry.jersey;
  });

  return map;
}

export interface PlayerHandedness {
  name: string;
  bats: BatHand;
}

// ── Season / Career / Game stats ──

export interface SeasonStats {
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

export interface CareerStats {
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

/** Per-player stats from a single boxscore */
export interface GameBattingStats {
  name: string;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
}

// ── Data file shapes ──

/** Parsed data from a single boxscore */
export interface BoxscoreData {
  date: string;
  opponent: string;
  url: string;
  playerStats: GameBattingStats[];
}

/** Per-year batting data file shape (batting-stats.json / batting-stats-{year}.json) */
export interface YearBattingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  teamGames: number;
  players: YearPlayer[];
  /** Wellesley-only: per-game boxscore data for wOBA cumulative tracking */
  boxscores?: BoxscoreData[];
}

export interface YearPlayer {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  season: SeasonStats;
}

// ── Team aggregate (merged from multiple YearBattingData) ──

export interface RosterPlayer {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  seasons: SeasonStats[];
  career: CareerStats;
}

export interface Team {
  slug: string;
  domain: string;
  scrapedAt: string;
  players: RosterPlayer[];
  teamGamesByYear?: Record<string, number>;
}

// ── Display types ──

export interface CumulativeEntry {
  year: number;
  woba: number;
  pa: number;
}

export interface YearData {
  season: SeasonStats;
  cumulative: { woba: number; pa: number };
  cumulativeLabel: string;
}

export interface DisplayRow {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  seasons: SeasonStats[];
  cumulativeByYear: CumulativeEntry[];
  yearData: Map<number, YearData>;
  career: CareerStats;
  tier: PlayerTier;
  paPerGame: number;
}
