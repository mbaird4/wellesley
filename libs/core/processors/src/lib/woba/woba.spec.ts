import type { BoxscoreData, PlayerSeasonStats } from '@ws/core/models';

import { calculateWoba, computePlayerCumulativeWobas, computePlayerSeasonWobas, getWobaTier, WOBA_WEIGHT_1B, WOBA_WEIGHT_2B, WOBA_WEIGHT_3B, WOBA_WEIGHT_BB, WOBA_WEIGHT_HBP, WOBA_WEIGHT_HR } from './woba';

function emptyStats(): Parameters<typeof calculateWoba>[0] {
  return { ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 };
}

describe('calculateWoba', () => {
  it('returns 0 when the denominator (AB + BB + HBP + SF + SH) is zero', () => {
    expect(calculateWoba(emptyStats())).toBe(0);
  });

  it('computes wOBA as a weighted average over PAs', () => {
    // 10 PA: 2 singles, 1 double, 1 HR, 2 BB, 4 outs
    const stats = { ab: 8, h: 4, doubles: 1, triples: 0, hr: 1, bb: 2, hbp: 0, sf: 0, sh: 0 };
    const expected = (WOBA_WEIGHT_1B * 2 + WOBA_WEIGHT_2B * 1 + WOBA_WEIGHT_HR * 1 + WOBA_WEIGHT_BB * 2) / 10;

    expect(calculateWoba(stats)).toBeCloseTo(expected, 6);
  });

  it('weights a triple higher than a double and a double higher than a single', () => {
    expect(WOBA_WEIGHT_3B).toBeGreaterThan(WOBA_WEIGHT_2B);
    expect(WOBA_WEIGHT_2B).toBeGreaterThan(WOBA_WEIGHT_1B);
    expect(WOBA_WEIGHT_HR).toBeGreaterThan(WOBA_WEIGHT_3B);
  });

  it('weights HBP and BB equally', () => {
    expect(WOBA_WEIGHT_BB).toBe(WOBA_WEIGHT_HBP);
  });

  it('treats H as the sum of singles+doubles+triples+HR (derived from h, not total hits)', () => {
    // All hits are HR
    const allHrs = { ab: 4, h: 4, doubles: 0, triples: 0, hr: 4, bb: 0, hbp: 0, sf: 0, sh: 0 };
    // All hits are singles
    const allSingles = { ab: 4, h: 4, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 };

    expect(calculateWoba(allHrs)).toBeCloseTo(WOBA_WEIGHT_HR, 6);
    expect(calculateWoba(allSingles)).toBeCloseTo(WOBA_WEIGHT_1B, 6);
  });

  it('includes SF and SH in the denominator (PA), so they suppress wOBA', () => {
    const withoutSf = { ab: 4, h: 1, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 };
    const withSf = { ...withoutSf, sf: 1 };

    expect(calculateWoba(withSf)).toBeLessThan(calculateWoba(withoutSf));
  });
});

describe('getWobaTier', () => {
  it('returns a tier string for a known wOBA', () => {
    // Just verify it's non-empty; the scale is in woba-display.ts
    expect(typeof getWobaTier(0.35)).toBe('string');
  });
});

describe('computePlayerSeasonWobas', () => {
  it('returns an empty array for no players', () => {
    expect(computePlayerSeasonWobas([])).toEqual([]);
  });

  it('sorts by wOBA descending', () => {
    const players: PlayerSeasonStats[] = [
      { name: 'Low', ab: 10, h: 1, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 },
      { name: 'High', ab: 10, h: 5, doubles: 2, triples: 0, hr: 1, bb: 0, hbp: 0, sf: 0, sh: 0 },
    ];
    const result = computePlayerSeasonWobas(players);

    expect(result.map((p) => p.name)).toEqual(['High', 'Low']);
  });

  it('derives singles by subtracting extra-base hits from hits', () => {
    const p: PlayerSeasonStats = { name: 'Jane', ab: 10, h: 5, doubles: 2, triples: 1, hr: 1, bb: 0, hbp: 0, sf: 0, sh: 0 };
    const [result] = computePlayerSeasonWobas([p]);

    expect(result.singles).toBe(1); // 5 - 2 - 1 - 1
  });

  it('derives PA as AB + BB + HBP + SF + SH', () => {
    const p: PlayerSeasonStats = { name: 'Jane', ab: 10, h: 3, doubles: 0, triples: 0, hr: 0, bb: 2, hbp: 1, sf: 1, sh: 1 };
    const [result] = computePlayerSeasonWobas([p]);

    expect(result.pa).toBe(15);
  });
});

describe('computePlayerCumulativeWobas', () => {
  function boxscore(date: string, playerStats: BoxscoreData['playerStats']): BoxscoreData {
    return { date, opponent: 'Opponent', url: `url-${date}`, playerStats };
  }

  it('returns an empty array for no boxscores', () => {
    expect(computePlayerCumulativeWobas([])).toEqual([]);
  });

  it('skips games where the player had zero PA', () => {
    const boxes: BoxscoreData[] = [boxscore('2025-03-01', [{ name: 'Jane', ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 }]), boxscore('2025-03-02', [{ name: 'Jane', ab: 3, h: 1, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 }])];
    const result = computePlayerCumulativeWobas(boxes);

    expect(result).toHaveLength(1);
    expect(result[0].games).toHaveLength(1);
    expect(result[0].games[0].date).toBe('2025-03-02');
  });

  it('accumulates stats across games and computes a rising cumulative wOBA for improving stats', () => {
    const boxes: BoxscoreData[] = [boxscore('g1', [{ name: 'Jane', ab: 3, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 }]), boxscore('g2', [{ name: 'Jane', ab: 3, h: 3, doubles: 1, triples: 0, hr: 1, bb: 0, hbp: 0, sf: 0, sh: 0 }])];
    const [jane] = computePlayerCumulativeWobas(boxes);

    expect(jane.games).toHaveLength(2);
    expect(jane.games[0].cumulativeWoba).toBeLessThan(jane.games[1].cumulativeWoba);
  });

  it('sorts players by final cumulative wOBA descending', () => {
    const boxes: BoxscoreData[] = [
      boxscore('g1', [
        { name: 'Hot', ab: 4, h: 3, doubles: 1, triples: 0, hr: 1, bb: 0, hbp: 0, sf: 0, sh: 0 },
        { name: 'Cold', ab: 4, h: 1, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 },
      ]),
    ];
    const result = computePlayerCumulativeWobas(boxes);

    expect(result.map((p) => p.name)).toEqual(['Hot', 'Cold']);
  });
});
