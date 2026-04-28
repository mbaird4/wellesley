// ── Minimum interfaces for wOBA computation ──
// These are the subset shapes that woba functions need.
// The canonical full types (SeasonStats, GameBattingStats, etc.) live in
// @ws/data-access/batting-types and are structural supersets of these.

/** Minimum fields needed for season-level wOBA computation */
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

/** Minimum fields needed for per-game wOBA computation */
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

// ── wOBA display/computation types ──

import type { MetricTier } from './metric-tier.models';

/** @deprecated Use MetricTier instead */
export type WobaTier = MetricTier;

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
    /** Unique per-game identifier (boxscore URL). Distinguishes doubleheaders on the same date. */
    gameUrl: string;
    gameWoba: number;
    cumulativeWoba: number;
    tier: WobaTier;
  }[];
}
