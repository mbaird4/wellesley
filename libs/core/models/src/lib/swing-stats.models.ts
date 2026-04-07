export interface SwingQueryConfig {
  /** Pitch indices to check (0-based). Default: [0] for first pitch */
  pitchIndices: number[];
  /** 'any' = swung at ANY of the specified pitches; 'all' = swung at ALL */
  mode: 'any' | 'all';
}

export interface BatterSwingStats {
  batterName: string;
  /** PAs that have pitch sequence data */
  totalPAs: number;
  /** PAs where batter swung per the query config */
  swingCount: number;
  /** swingCount / totalPAs */
  swingRate: number;
}
