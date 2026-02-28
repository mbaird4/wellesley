export interface OpponentTeam {
  slug: string;
  domain: string;
  scrapedAt: string;
  players: OpponentPlayer[];
}

export interface OpponentPlayer {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  seasons: OpponentSeasonStats[];
  career: OpponentCareerStats;
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

export interface OpponentDisplayRow {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  seasons: OpponentSeasonStats[];
  cumulativeByYear: { year: number; woba: number; pa: number }[];
  career: OpponentCareerStats;
}
