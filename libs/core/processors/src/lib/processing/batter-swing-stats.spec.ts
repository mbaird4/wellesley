import type { PitchCode, PitchSequence, PitchSequenceRecord } from '@ws/core/models';

import { computeBatterSwingStats, didSwingAtPitch } from './batter-swing-stats';

function sequence(pitches: PitchCode[]): PitchSequence {
  return {
    balls: pitches.filter((p) => p === 'B').length,
    strikes: pitches.filter((p) => p === 'K' || p === 'S' || p === 'F').length,
    pitches,
    unknownCodes: [],
  };
}

function record(overrides: Partial<PitchSequenceRecord> & { batterName: string; pitches: PitchCode[] }): PitchSequenceRecord {
  return {
    gameUrl: 'url',
    opponent: 'Opponent',
    date: '2025-03-01',
    inning: '1st',
    outs: 0,
    basesBefore: { first: false, second: false, third: false },
    pitcherName: 'P. Pitcher',
    batterResult: 'out',
    playText: '',
    ...overrides,
    sequence: sequence(overrides.pitches),
  };
}

// ── didSwingAtPitch ──

describe('didSwingAtPitch', () => {
  it('returns true for swinging strike (S)', () => {
    expect(didSwingAtPitch(sequence(['S']), 0)).toBe(true);
  });

  it('returns true for foul (F) — foul requires a swing', () => {
    expect(didSwingAtPitch(sequence(['F']), 0)).toBe(true);
  });

  it('returns false for called strike (K) — batter took the pitch', () => {
    expect(didSwingAtPitch(sequence(['K']), 0)).toBe(false);
  });

  it('returns false for ball (B)', () => {
    expect(didSwingAtPitch(sequence(['B']), 0)).toBe(false);
  });

  it('returns true for the inferred ball-in-play pitch (index == pitches.length)', () => {
    // "K" = called strike 1, then ball in play on pitch 2 (not in sequence)
    expect(didSwingAtPitch(sequence(['K']), 1)).toBe(true);
  });

  it('returns null when the queried pitch index never occurred', () => {
    // Sequence "BBBB" = walk on pitch 4 → pitch 5 never thrown
    expect(didSwingAtPitch(sequence(['B', 'B', 'B', 'B']), 4)).toBeNull();
  });

  it('returns null for pitch 1 when the PA ended on pitch 0 (ball in play)', () => {
    // Empty sequence → 1 pitch total (inferred BIP), so index 1 never occurred
    expect(didSwingAtPitch(sequence([]), 1)).toBeNull();
  });
});

// ── computeBatterSwingStats ──

describe('computeBatterSwingStats', () => {
  it('computes per-batter first-pitch swing rate by default', () => {
    const records = [
      record({ batterName: 'Jane', pitches: ['S'] }), // swung 1st pitch
      record({ batterName: 'Jane', pitches: ['K'] }), // took 1st pitch
      record({ batterName: 'Jane', pitches: ['F'] }), // swung (foul)
    ];
    const [stats] = computeBatterSwingStats(records);

    expect(stats.batterName).toBe('Jane');
    expect(stats.totalPAs).toBe(3);
    expect(stats.swingCount).toBe(2);
    expect(stats.swingRate).toBeCloseTo(2 / 3, 6);
  });

  it('sorts results by swing rate descending', () => {
    const records = [record({ batterName: 'Passive', pitches: ['K'] }), record({ batterName: 'Passive', pitches: ['B'] }), record({ batterName: 'Aggressive', pitches: ['S'] }), record({ batterName: 'Aggressive', pitches: ['F'] })];
    const stats = computeBatterSwingStats(records);

    expect(stats[0].batterName).toBe('Aggressive');
    expect(stats[1].batterName).toBe('Passive');
  });

  it('excludes PAs where the queried pitch never occurred', () => {
    // Query pitch index 2; second PA only saw 1 pitch
    const records = [
      record({ batterName: 'Jane', pitches: ['K', 'K', 'S'] }), // swung on pitch 2
      record({ batterName: 'Jane', pitches: ['B', 'B', 'B', 'B'] }), // walked on pitch 4; pitch 2 was a B, but let me reconsider
    ];
    const [stats] = computeBatterSwingStats(records, { pitchIndices: [2], mode: 'any' });

    // Both PAs have pitch index 2 (it exists). Jane swung on PA #1 (S), took on PA #2 (B).
    expect(stats.totalPAs).toBe(2);
    expect(stats.swingCount).toBe(1);
  });

  it('truly excludes PAs where queried pitch was never thrown', () => {
    // Query pitch index 5; neither PA had that many pitches.
    const records = [
      record({ batterName: 'Jane', pitches: ['S'] }), // total 2 pitches (S + BIP)
      record({ batterName: 'Jane', pitches: ['K', 'K'] }), // total 3 pitches (K + K + BIP)
    ];
    const stats = computeBatterSwingStats(records, { pitchIndices: [5], mode: 'any' });

    expect(stats).toHaveLength(0);
  });

  it("mode='any' counts PAs where ANY queried pitch was swung at", () => {
    const records = [
      // Pitch 0: K (took), Pitch 1: S (swung)
      record({ batterName: 'Jane', pitches: ['K', 'S'] }),
      // Pitch 0: K (took), Pitch 1: K (took)
      record({ batterName: 'Jane', pitches: ['K', 'K'] }),
    ];
    const [stats] = computeBatterSwingStats(records, { pitchIndices: [0, 1], mode: 'any' });

    expect(stats.totalPAs).toBe(2);
    expect(stats.swingCount).toBe(1);
  });

  it("mode='all' counts PAs where ALL queried pitches were swung at", () => {
    const records = [
      record({ batterName: 'Jane', pitches: ['S', 'S'] }), // swung both
      record({ batterName: 'Jane', pitches: ['S', 'K'] }), // swung first, took second
    ];
    const [stats] = computeBatterSwingStats(records, { pitchIndices: [0, 1], mode: 'all' });

    expect(stats.totalPAs).toBe(2);
    expect(stats.swingCount).toBe(1);
  });
});
