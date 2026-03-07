// ── Season stats types (full stat-page dump: hitting, pitching, fielding) ──

export interface SeasonStatsPlayer {
  name: string;
  jerseyNumber: number | null;
}

// ── Hitting ──

export interface HittingRow extends SeasonStatsPlayer {
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
}

// ── Pitching ──

export interface PitchingRow extends SeasonStatsPlayer {
  era: number;
  whip: number;
  w: number;
  l: number;
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
  doubles: number;
  triples: number;
  hr: number;
  ab: number;
  bAvg: number;
  wp: number;
  hbp: number;
  bk: number;
  sfa: number;
  sha: number;
}

// ── Fielding ──

export interface FieldingRow extends SeasonStatsPlayer {
  tc: number;
  po: number;
  a: number;
  e: number;
  fldPct: number;
  dp: number;
  sba: number;
  csb: number;
  pb: number;
  ci: number;
}

// ── Aggregated table (players + totals + opponents) ──

export interface StatTable<T> {
  players: T[];
  totals: Omit<T, 'name' | 'jerseyNumber'> | null;
  opponents: Omit<T, 'name' | 'jerseyNumber'> | null;
}

// ── Top-level season stats file ──

export interface SeasonStatsData {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  hitting: StatTable<HittingRow>;
  pitching: StatTable<PitchingRow>;
  fielding: StatTable<FieldingRow>;
}
