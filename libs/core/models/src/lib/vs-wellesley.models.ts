/** Granular out types derived from play text */
export type OutType = 'strikeout' | 'groundout' | 'flyout' | 'lineout' | 'popup' | 'foulout';

export interface BatterVsStats {
  batterName: string;
  // Hits
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  // On-base (non-hit)
  walks: number;
  hbp: number;
  reached: number; // FC, error, dropped 3rd strike
  // Outs — granular
  strikeouts: number;
  groundouts: number;
  flyouts: number;
  lineouts: number;
  popups: number;
  foulouts: number;
  doublePlays: number;
  // Sacrifices
  sacBunts: number;
  sacFlies: number;
  // Totals
  totalPA: number;
}

export interface VsWellesleyData {
  games: { date: string; url: string; year: number }[];
  wellesleyPitchers: string[];
  overall: BatterVsStats[];
  byPitcher: Record<string, BatterVsStats[]>;
}
