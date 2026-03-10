export type ContactType = 'hit' | 'line_out' | 'ground_ball' | 'popup' | 'bunt' | 'unknown';

export type ContactQuality = 'hard' | 'weak';

export type SprayOutcome = 'hit' | 'out' | 'error';

export type SprayZone = 'lf_line' | 'lf' | 'lf_cf' | 'cf' | 'rf_cf' | 'rf' | 'rf_line' | 'if_3b' | 'if_ss' | 'if_2b' | 'if_1b' | 'if_p' | 'if_c' | 'plate_3b' | 'plate_p' | 'plate_1b';

export interface SprayDataPoint {
  playerName: string;
  zone: SprayZone;
  contactType: ContactType;
  outcome: SprayOutcome;
  hitType: string;
  direction: string;
  angle: number;
  isInfield: boolean;
  playText: string;
  gameIndex: number;
  inning: string;
  outsBefore: number;
  runnersOnBase: boolean;
  risp: boolean;
}

export interface ZoneAggregate {
  zone: SprayZone;
  total: number;
  hits: number;
  outs: number;
  errors: number;
  pct: number;
  battingAvg: number;
}

export interface SprayChartSummary {
  playerName: string | null;
  dataPoints: SprayDataPoint[];
  zones: ZoneAggregate[];
  totalContact: number;
}

export interface SprayFilters {
  playerName?: string | null;
  outcomes?: SprayOutcome[];
  contactTypes?: ContactType[];
  contactQualities?: ContactQuality[];
  outCount?: number[];
  risp?: boolean;
}
