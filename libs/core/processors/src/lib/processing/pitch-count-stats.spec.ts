import type { PitchCode, PitchSequenceRecord } from '@ws/core/models';

import { computePitchCount, computePitchCountByInning } from './pitch-count-stats';

function record(overrides: Partial<PitchSequenceRecord> & { pitcherName: string; inning: string; pitches: PitchCode[] }): PitchSequenceRecord {
  return {
    gameUrl: 'url',
    opponent: 'Opponent',
    date: '2025-03-01',
    outs: 0,
    basesBefore: { first: false, second: false, third: false },
    batterName: 'A. Batter',
    batterResult: 'out',
    playText: '',
    ...overrides,
    sequence: {
      balls: overrides.pitches.filter((p) => p === 'B').length,
      strikes: overrides.pitches.filter((p) => p === 'K' || p === 'S' || p === 'F').length,
      pitches: overrides.pitches,
      unknownCodes: [],
    },
  };
}

// ── computePitchCount ──

describe('computePitchCount', () => {
  it('treats an empty sequence as 1 pitch (inferred ball-in-play)', () => {
    expect(computePitchCount([])).toBe(1);
  });

  it('adds 1 for a sequence ending in foul (fouls cannot end at-bats)', () => {
    expect(computePitchCount(['F'])).toBe(2);
    expect(computePitchCount(['K', 'F'])).toBe(3);
  });

  it('returns the length when the sequence ends with HBP (H)', () => {
    expect(computePitchCount(['B', 'H'])).toBe(2);
  });

  it('returns the length for a 4-ball walk', () => {
    expect(computePitchCount(['B', 'B', 'B', 'B'])).toBe(4);
    expect(computePitchCount(['B', 'K', 'B', 'B', 'B'])).toBe(5);
  });

  it('treats 3 S/K pitches as a strikeout (no extra pitch)', () => {
    expect(computePitchCount(['K', 'K', 'K'])).toBe(3);
    expect(computePitchCount(['S', 'S', 'S'])).toBe(3);
    expect(computePitchCount(['K', 'S', 'K'])).toBe(3);
  });

  it('counts 1 S/K + 2+ fouls as a strikeout (3 total strikes)', () => {
    // Final pitch is S; prior pitches include 2 fouls → strike total is 3
    expect(computePitchCount(['F', 'F', 'S'])).toBe(3);
  });

  it('adds 1 for 1 S/K with fewer than 2 fouls (ball put in play)', () => {
    // K alone — could be foul tip → BIP, so count + 1
    expect(computePitchCount(['K'])).toBe(2);
    // 1 foul + 1 S → strike total is 2, ball must have been put in play
    expect(computePitchCount(['F', 'S'])).toBe(3);
  });

  it('counts 2 S/K with at least one foul as a strikeout (3 strikes)', () => {
    expect(computePitchCount(['S', 'F', 'K'])).toBe(3);
  });

  it('adds 1 for 2 S/K with no foul (only 2 strikes → ball in play)', () => {
    expect(computePitchCount(['K', 'S'])).toBe(3);
  });

  it('adds 1 for any sequence not otherwise classified as ending the AB', () => {
    // Just a ball then presumed BIP
    expect(computePitchCount(['B'])).toBe(2);
  });
});

// ── computePitchCountByInning ──

describe('computePitchCountByInning', () => {
  it('returns empty totals and an empty map when the pitcher has no records', () => {
    const { byInning, totals } = computePitchCountByInning([], 'J. Pitcher');

    expect(byInning.size).toBe(0);
    expect(totals.pasWithSequence).toBe(0);
    expect(totals.totalPitches).toBe(0);
  });

  it('filters out records thrown by other pitchers', () => {
    const records = [record({ pitcherName: 'J. Pitcher', inning: '1st', pitches: ['S'] }), record({ pitcherName: 'Other', inning: '1st', pitches: ['B'] })];
    const { byInning, totals } = computePitchCountByInning(records, 'J. Pitcher');

    expect(byInning.size).toBe(1);
    expect(totals.pasWithSequence).toBe(1);
  });

  it('computes first-pitch strike/swing-miss rates', () => {
    const records = [
      record({ pitcherName: 'J. Pitcher', inning: '1st', pitches: ['S'] }), // strike + swing miss
      record({ pitcherName: 'J. Pitcher', inning: '1st', pitches: ['K'] }), // strike, no swing miss
      record({ pitcherName: 'J. Pitcher', inning: '1st', pitches: ['B'] }), // ball
    ];
    const { totals } = computePitchCountByInning(records, 'J. Pitcher');

    expect(totals.firstPitchCount).toBe(3);
    expect(totals.firstPitchStrikes).toBe(2);
    expect(totals.firstPitchSwingMiss).toBe(1);
  });

  it('sorts innings numerically', () => {
    const records = [record({ pitcherName: 'J. Pitcher', inning: '3rd', pitches: ['S'] }), record({ pitcherName: 'J. Pitcher', inning: '1st', pitches: ['S'] }), record({ pitcherName: 'J. Pitcher', inning: '2nd', pitches: ['S'] })];
    const { byInning } = computePitchCountByInning(records, 'J. Pitcher');

    expect(Array.from(byInning.keys())).toEqual(['1st', '2nd', '3rd']);
  });

  it('accumulates totals across innings', () => {
    const records = [record({ pitcherName: 'J. Pitcher', inning: '1st', pitches: ['S'] }), record({ pitcherName: 'J. Pitcher', inning: '2nd', pitches: ['B', 'K', 'S'] })];
    const { totals } = computePitchCountByInning(records, 'J. Pitcher');

    expect(totals.pasWithSequence).toBe(2);
    expect(totals.balls).toBe(1);
    expect(totals.strikes).toBe(3);
  });
});
