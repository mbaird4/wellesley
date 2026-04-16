import type { PitcherInningStats, PitcherTrackedPlay } from '@ws/core/models';

import { battingAvgAgainst, computePitcherGameLog, computePitcherInningStats, computePitcherSeasonSummary, inningToNumber } from './pitcher-stats';

// ── Helpers ──

function makePlay(overrides: Partial<PitcherTrackedPlay> = {}): PitcherTrackedPlay {
  return {
    activePitcher: 'J. Pitcher',
    inning: '1st',
    batterName: 'A. Batter',
    batterResult: 'out',
    playText: 'A. Batter grounded out to ss.',
    runsScored: 0,
    hitsOnPlay: 0,
    isPlateAppearance: true,
    ...overrides,
  };
}

// ── inningToNumber ──

describe('inningToNumber', () => {
  it('parses standard inning strings', () => {
    expect(inningToNumber('1st')).toBe(1);
    expect(inningToNumber('2nd')).toBe(2);
    expect(inningToNumber('3rd')).toBe(3);
    expect(inningToNumber('4th')).toBe(4);
    expect(inningToNumber('7th')).toBe(7);
  });

  it('returns 0 for unrecognized format', () => {
    expect(inningToNumber('Extra')).toBe(0);
    expect(inningToNumber('')).toBe(0);
  });
});

// ── computePitcherInningStats ──

describe('computePitcherInningStats', () => {
  it('groups plays by pitcher and inning', () => {
    const plays: PitcherTrackedPlay[] = [makePlay({ inning: '1st', batterResult: 'out' }), makePlay({ inning: '1st', batterResult: 'single', hitsOnPlay: 1 }), makePlay({ inning: '2nd', batterResult: 'walk' })];

    const result = computePitcherInningStats(plays);
    const pitcherStats = result.get('J. Pitcher') ?? [];

    expect(pitcherStats).toHaveLength(2);
    expect(pitcherStats[0].inning).toBe('1st');
    expect(pitcherStats[0].battersFaced).toBe(2);
    expect(pitcherStats[0].hits).toBe(1);
    expect(pitcherStats[0].outs).toBe(1);
    expect(pitcherStats[1].inning).toBe('2nd');
    expect(pitcherStats[1].battersFaced).toBe(1);
    expect(pitcherStats[1].walks).toBe(1);
  });

  it('separates stats for different pitchers', () => {
    const plays: PitcherTrackedPlay[] = [
      makePlay({
        activePitcher: 'A. Starter',
        inning: '1st',
        batterResult: 'out',
      }),
      makePlay({
        activePitcher: 'B. Relief',
        inning: '1st',
        batterResult: 'single',
        hitsOnPlay: 1,
      }),
    ];

    const result = computePitcherInningStats(plays);

    expect(result.has('A. Starter')).toBe(true);
    expect(result.has('B. Relief')).toBe(true);
    expect((result.get('A. Starter') ?? [])[0].battersFaced).toBe(1);
    expect((result.get('B. Relief') ?? [])[0].battersFaced).toBe(1);
  });

  it('counts hit types correctly', () => {
    const plays: PitcherTrackedPlay[] = [makePlay({ batterResult: 'single', hitsOnPlay: 1 }), makePlay({ batterResult: 'double', hitsOnPlay: 1 }), makePlay({ batterResult: 'triple', hitsOnPlay: 1 }), makePlay({ batterResult: 'homer', hitsOnPlay: 1, runsScored: 1 })];

    const result = computePitcherInningStats(plays);
    const stats = (result.get('J. Pitcher') ?? [])[0];

    expect(stats.singles).toBe(1);
    expect(stats.doubles).toBe(1);
    expect(stats.triples).toBe(1);
    expect(stats.hr).toBe(1);
    expect(stats.hits).toBe(4);
    expect(stats.runs).toBe(1);
  });

  it('counts strikeouts from play text', () => {
    const plays: PitcherTrackedPlay[] = [
      makePlay({
        batterResult: 'out',
        playText: 'A. Batter struck out swinging.',
      }),
      makePlay({
        batterResult: 'out',
        playText: 'B. Batter struck out looking.',
      }),
      makePlay({
        batterResult: 'out',
        playText: 'C. Batter grounded out to ss.',
      }),
    ];

    const result = computePitcherInningStats(plays);
    const stats = (result.get('J. Pitcher') ?? [])[0];

    expect(stats.strikeouts).toBe(2);
    expect(stats.outs).toBe(3);
  });

  it('handles sac bunt and sac fly (not counted as AB)', () => {
    const plays: PitcherTrackedPlay[] = [makePlay({ batterResult: 'sac_bunt' }), makePlay({ batterResult: 'sac_fly' })];

    const result = computePitcherInningStats(plays);
    const stats = (result.get('J. Pitcher') ?? [])[0];

    expect(stats.battersFaced).toBe(2);
    expect(stats.ab).toBe(0);
    expect(stats.outs).toBe(2);
  });

  it('handles double play — 2 outs, 1 AB', () => {
    const plays: PitcherTrackedPlay[] = [makePlay({ batterResult: 'double_play' })];

    const result = computePitcherInningStats(plays);
    const stats = (result.get('J. Pitcher') ?? [])[0];

    expect(stats.battersFaced).toBe(1);
    expect(stats.ab).toBe(1);
    expect(stats.outs).toBe(2);
  });

  it('counts runs from non-PA events (wild pitch)', () => {
    const plays: PitcherTrackedPlay[] = [
      makePlay({
        isPlateAppearance: false,
        batterResult: 'none',
        runsScored: 1,
        playText: 'Wild pitch; A. Runner scored.',
      }),
    ];

    const result = computePitcherInningStats(plays);
    const stats = (result.get('J. Pitcher') ?? [])[0];

    expect(stats.battersFaced).toBe(0);
    expect(stats.runs).toBe(1);
  });
});

// ── computePitcherGameLog ──

describe('computePitcherGameLog', () => {
  it('produces a game log with totals', () => {
    const plays: PitcherTrackedPlay[] = [makePlay({ inning: '1st', batterResult: 'out' }), makePlay({ inning: '1st', batterResult: 'single', hitsOnPlay: 1 }), makePlay({ inning: '1st', batterResult: 'out' }), makePlay({ inning: '2nd', batterResult: 'out' }), makePlay({ inning: '2nd', batterResult: 'out' }), makePlay({ inning: '2nd', batterResult: 'out' })];

    const logs = computePitcherGameLog(plays, {
      date: '3/15/2025',
      opponent: 'MIT',
      url: 'https://example.com/boxscore',
    });

    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log.pitcher).toBe('J. Pitcher');
    expect(log.date).toBe('3/15/2025');
    expect(log.opponent).toBe('MIT');
    expect(log.innings).toHaveLength(2);
    expect(log.totals.battersFaced).toBe(6);
    expect(log.totals.hits).toBe(1);
    expect(log.totals.outs).toBe(5);
  });
});

// ── computePitcherSeasonSummary ──

describe('computePitcherSeasonSummary', () => {
  it('aggregates across multiple games', () => {
    const gameLogs = [
      {
        date: '3/10/2025',
        opponent: 'MIT',
        url: 'url1',
        pitcher: 'J. Pitcher',
        innings: [
          {
            inning: '1st',
            battersFaced: 3,
            ab: 3,
            hits: 1,
            singles: 1,
            doubles: 0,
            triples: 0,
            hr: 0,
            runs: 0,
            outs: 2,
            walks: 0,
            strikeouts: 1,
            hbp: 0,
            sf: 0,
            sh: 0,
          },
          {
            inning: '2nd',
            battersFaced: 3,
            ab: 3,
            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            hr: 0,
            runs: 0,
            outs: 3,
            walks: 0,
            strikeouts: 2,
            hbp: 0,
            sf: 0,
            sh: 0,
          },
        ],
        totals: {
          inning: 'Total',
          battersFaced: 6,
          ab: 6,
          hits: 1,
          singles: 1,
          doubles: 0,
          triples: 0,
          hr: 0,
          runs: 0,
          outs: 5,
          walks: 0,
          strikeouts: 3,
          hbp: 0,
          sf: 0,
          sh: 0,
        },
      },
      {
        date: '3/15/2025',
        opponent: 'Clark',
        url: 'url2',
        pitcher: 'J. Pitcher',
        innings: [
          {
            inning: '1st',
            battersFaced: 4,
            ab: 3,
            hits: 2,
            singles: 1,
            doubles: 1,
            triples: 0,
            hr: 0,
            runs: 1,
            outs: 1,
            walks: 1,
            strikeouts: 0,
            hbp: 0,
            sf: 0,
            sh: 0,
          },
        ],
        totals: {
          inning: 'Total',
          battersFaced: 4,
          ab: 3,
          hits: 2,
          singles: 1,
          doubles: 1,
          triples: 0,
          hr: 0,
          runs: 1,
          outs: 1,
          walks: 1,
          strikeouts: 0,
          hbp: 0,
          sf: 0,
          sh: 0,
        },
      },
    ];

    const summaries = computePitcherSeasonSummary(gameLogs);

    expect(summaries).toHaveLength(1);
    const summary = summaries[0];
    expect(summary.pitcher).toBe('J. Pitcher');
    expect(summary.games).toBe(2);
    expect(summary.totals.battersFaced).toBe(10);
    expect(summary.totals.hits).toBe(3);
    expect(summary.totals.runs).toBe(1);

    // By-inning aggregation
    const first = summary.byInning.get('1st')!;
    expect(first.battersFaced).toBe(7); // 3 + 4
    expect(first.hits).toBe(3); // 1 + 2
  });

  it('sorts pitchers by games pitched descending', () => {
    const gameLogs = [
      {
        date: '3/10',
        opponent: 'A',
        url: 'u1',
        pitcher: 'Starter',
        innings: [
          {
            inning: '1st',
            battersFaced: 3,
            ab: 3,
            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            hr: 0,
            runs: 0,
            outs: 3,
            walks: 0,
            strikeouts: 0,
            hbp: 0,
            sf: 0,
            sh: 0,
          },
        ],
        totals: {
          inning: 'Total',
          battersFaced: 3,
          ab: 3,
          hits: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          hr: 0,
          runs: 0,
          outs: 3,
          walks: 0,
          strikeouts: 0,
          hbp: 0,
          sf: 0,
          sh: 0,
        },
      },
      {
        date: '3/12',
        opponent: 'B',
        url: 'u2',
        pitcher: 'Starter',
        innings: [
          {
            inning: '1st',
            battersFaced: 3,
            ab: 3,
            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            hr: 0,
            runs: 0,
            outs: 3,
            walks: 0,
            strikeouts: 0,
            hbp: 0,
            sf: 0,
            sh: 0,
          },
        ],
        totals: {
          inning: 'Total',
          battersFaced: 3,
          ab: 3,
          hits: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          hr: 0,
          runs: 0,
          outs: 3,
          walks: 0,
          strikeouts: 0,
          hbp: 0,
          sf: 0,
          sh: 0,
        },
      },
      {
        date: '3/10',
        opponent: 'A',
        url: 'u1',
        pitcher: 'Relief',
        innings: [
          {
            inning: '3rd',
            battersFaced: 1,
            ab: 1,
            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            hr: 0,
            runs: 0,
            outs: 1,
            walks: 0,
            strikeouts: 0,
            hbp: 0,
            sf: 0,
            sh: 0,
          },
        ],
        totals: {
          inning: 'Total',
          battersFaced: 1,
          ab: 1,
          hits: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          hr: 0,
          runs: 0,
          outs: 1,
          walks: 0,
          strikeouts: 0,
          hbp: 0,
          sf: 0,
          sh: 0,
        },
      },
    ];

    const summaries = computePitcherSeasonSummary(gameLogs);

    expect(summaries[0].pitcher).toBe('Starter');
    expect(summaries[0].games).toBe(2);
    expect(summaries[1].pitcher).toBe('Relief');
    expect(summaries[1].games).toBe(1);
  });
});

// ── battingAvgAgainst ──

describe('battingAvgAgainst', () => {
  it('computes hits / AB', () => {
    const stats: PitcherInningStats = {
      inning: '1st',
      battersFaced: 10,
      ab: 8,
      hits: 3,
      singles: 2,
      doubles: 1,
      triples: 0,
      hr: 0,
      runs: 1,
      outs: 5,
      walks: 1,
      strikeouts: 2,
      hbp: 1,
      sf: 0,
      sh: 0,
    };

    expect(battingAvgAgainst(stats)).toBeCloseTo(0.375, 3);
  });

  it('returns 0 when AB is 0', () => {
    const stats: PitcherInningStats = {
      inning: '1st',
      battersFaced: 2,
      ab: 0,
      hits: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      hr: 0,
      runs: 0,
      outs: 0,
      walks: 1,
      strikeouts: 0,
      hbp: 1,
      sf: 0,
      sh: 0,
    };

    expect(battingAvgAgainst(stats)).toBe(0);
  });
});
