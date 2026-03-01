export type WobaTier =
  | 'excellent'
  | 'great'
  | 'above_average'
  | 'average'
  | 'below_average';

/** Raw per-player season totals scraped from the stats page */
export interface PlayerSeasonStats {
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

/** Per-player stats from a single boxscore */
export interface PlayerGameStats {
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

/** Parsed data from a single boxscore */
export interface BoxscoreData {
  date: string;
  opponent: string;
  url: string;
  playerStats: PlayerGameStats[];
}

/** Computed season wOBA with components */
export interface PlayerWoba {
  name: string;
  pa: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  woba: number;
  tier: WobaTier;
}

/** Per-player running wOBA across games */
export interface PlayerCumulativeWoba {
  name: string;
  games: {
    date: string;
    opponent: string;
    gameWoba: number;
    cumulativeWoba: number;
    tier: WobaTier;
  }[];
}

/** Combined season data returned by woba data service */
export interface WobaSeasonData {
  seasonStats: PlayerSeasonStats[];
  boxscores: BoxscoreData[];
}
