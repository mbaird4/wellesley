import {
  BoxscoreData,
  PlayerCumulativeWoba,
  PlayerGameStats,
  PlayerSeasonStats,
  PlayerWoba,
  WobaTier,
} from './types';

// wOBA linear weights
export const WOBA_WEIGHT_BB = 0.5;
export const WOBA_WEIGHT_HBP = 0.5;
export const WOBA_WEIGHT_1B = 0.9;
export const WOBA_WEIGHT_2B = 1.2;
export const WOBA_WEIGHT_3B = 1.7;
export const WOBA_WEIGHT_HR = 2.5;

// Tier thresholds
export const WOBA_TIER_EXCELLENT = 0.4;
export const WOBA_TIER_GREAT = 0.35;
export const WOBA_TIER_ABOVE_AVERAGE = 0.32;
export const WOBA_TIER_AVERAGE = 0.29;

export function calculateWoba(stats: {
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
}): number {
  const singles = stats.h - stats.doubles - stats.triples - stats.hr;
  const denominator = stats.ab + stats.bb + stats.sf + stats.sh + stats.hbp;
  if (denominator === 0) return 0;

  const numerator =
    WOBA_WEIGHT_BB * stats.bb +
    WOBA_WEIGHT_HBP * stats.hbp +
    WOBA_WEIGHT_1B * singles +
    WOBA_WEIGHT_2B * stats.doubles +
    WOBA_WEIGHT_3B * stats.triples +
    WOBA_WEIGHT_HR * stats.hr;

  return numerator / denominator;
}

export function getWobaTier(woba: number): WobaTier {
  if (woba >= WOBA_TIER_EXCELLENT) return 'excellent';
  if (woba >= WOBA_TIER_GREAT) return 'great';
  if (woba >= WOBA_TIER_ABOVE_AVERAGE) return 'above_average';
  if (woba >= WOBA_TIER_AVERAGE) return 'average';
  return 'below_average';
}

export function computePlayerSeasonWobas(
  players: PlayerSeasonStats[]
): PlayerWoba[] {
  return players
    .map((p) => {
      const woba = calculateWoba(p);
      const singles = p.h - p.doubles - p.triples - p.hr;
      const pa = p.ab + p.bb + p.sf + p.sh + p.hbp;
      return {
        name: p.name,
        pa,
        singles,
        doubles: p.doubles,
        triples: p.triples,
        hr: p.hr,
        bb: p.bb,
        hbp: p.hbp,
        woba,
        tier: getWobaTier(woba),
      };
    })
    .sort((a, b) => b.woba - a.woba);
}

export function computePlayerCumulativeWobas(
  boxscores: BoxscoreData[]
): PlayerCumulativeWoba[] {
  // Accumulate stats per player across games in order
  const playerAccum = new Map<
    string,
    {
      ab: number;
      h: number;
      doubles: number;
      triples: number;
      hr: number;
      bb: number;
      hbp: number;
      sf: number;
      sh: number;
      games: PlayerCumulativeWoba['games'];
    }
  >();

  for (const box of boxscores) {
    for (const ps of box.playerStats) {
      let acc = playerAccum.get(ps.name);
      if (!acc) {
        acc = {
          ab: 0,
          h: 0,
          doubles: 0,
          triples: 0,
          hr: 0,
          bb: 0,
          hbp: 0,
          sf: 0,
          sh: 0,
          games: [],
        };
        playerAccum.set(ps.name, acc);
      }

      // Game-level wOBA
      const gameWoba = calculateWoba(ps);

      // Accumulate
      acc.ab += ps.ab;
      acc.h += ps.h;
      acc.doubles += ps.doubles;
      acc.triples += ps.triples;
      acc.hr += ps.hr;
      acc.bb += ps.bb;
      acc.hbp += ps.hbp;
      acc.sf += ps.sf;
      acc.sh += ps.sh;

      const cumulativeWoba = calculateWoba(acc);

      acc.games.push({
        date: box.date,
        opponent: box.opponent,
        gameWoba,
        cumulativeWoba,
        tier: getWobaTier(cumulativeWoba),
      });
    }
  }

  return Array.from(playerAccum.entries())
    .map(([name, acc]) => ({ name, games: acc.games }))
    .sort((a, b) => {
      const aLast = a.games[a.games.length - 1]?.cumulativeWoba ?? 0;
      const bLast = b.games[b.games.length - 1]?.cumulativeWoba ?? 0;
      return bLast - aLast;
    });
}
