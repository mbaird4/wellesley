import type { BaseRunners, PlaySnapshot } from '@ws/core/models';

import { classifyBaseSituation, computeBaseRunnerStats, computeBaseRunnerStatsAtBatStart, mergeBaseRunnerStats } from './base-runner-stats';

// ── Helpers ──

function bases(first: string | null = null, second: string | null = null, third: string | null = null): BaseRunners {
  return { first, second, third };
}

function snap(overrides: Partial<PlaySnapshot> = {}): PlaySnapshot {
  return {
    playIndex: 0,
    playText: '',
    playType: 'plate_appearance',
    basesBefore: bases(),
    basesAfter: bases(),
    outsBefore: 0,
    outsAfter: 0,
    inning: '1st',
    batterName: 'A. Batter',
    lineupSlot: 1,
    currentBatterName: 'A. Batter',
    currentBatterSlot: 1,
    isPlateAppearance: true,
    scoringPlays: [],
    ...overrides,
  };
}

// ── classifyBaseSituation ──

describe('classifyBaseSituation', () => {
  it('returns "empty" when no runners are on', () => {
    expect(classifyBaseSituation(bases())).toBe('empty');
  });

  it('identifies each single-base situation', () => {
    expect(classifyBaseSituation(bases('R'))).toBe('first');
    expect(classifyBaseSituation(bases(null, 'R'))).toBe('second');
    expect(classifyBaseSituation(bases(null, null, 'R'))).toBe('third');
  });

  it('identifies each two-base situation', () => {
    expect(classifyBaseSituation(bases('R', 'R'))).toBe('first_second');
    expect(classifyBaseSituation(bases('R', null, 'R'))).toBe('first_third');
    expect(classifyBaseSituation(bases(null, 'R', 'R'))).toBe('second_third');
  });

  it('returns "loaded" when all bases are occupied', () => {
    expect(classifyBaseSituation(bases('R', 'R', 'R'))).toBe('loaded');
  });
});

// ── computeBaseRunnerStats ──

describe('computeBaseRunnerStats', () => {
  it('ensures all 9 lineup slots are present even when snapshots are empty', () => {
    const rows = computeBaseRunnerStats([]);

    expect(rows).toHaveLength(9);
    expect(rows.map((r) => r.lineupSlot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('tallies PAs by (slot, situation, outs)', () => {
    const snapshots: PlaySnapshot[] = [snap({ lineupSlot: 1, outsBefore: 0, basesBefore: bases() }), snap({ lineupSlot: 1, outsBefore: 1, basesBefore: bases('R') }), snap({ lineupSlot: 2, outsBefore: 2, basesBefore: bases(null, 'R') })];
    const rows = computeBaseRunnerStats(snapshots);

    const slot1 = rows.find((r) => r.lineupSlot === 1)!;
    const slot2 = rows.find((r) => r.lineupSlot === 2)!;

    expect(slot1.situations.empty[0]).toBe(1);
    expect(slot1.situations.first[1]).toBe(1);
    expect(slot2.situations.second[2]).toBe(1);
  });

  it('ignores non-PA snapshots (substitutions, stolen bases, etc.)', () => {
    const snapshots: PlaySnapshot[] = [snap({ lineupSlot: 1, outsBefore: 0, isPlateAppearance: false, playType: 'substitution' }), snap({ lineupSlot: 1, outsBefore: 0, isPlateAppearance: true })];
    const rows = computeBaseRunnerStats(snapshots);

    expect(rows.find((r) => r.lineupSlot === 1)!.situations.empty[0]).toBe(1);
  });

  it('ignores PAs with null lineupSlot', () => {
    const snapshots: PlaySnapshot[] = [snap({ lineupSlot: null, isPlateAppearance: true })];
    const rows = computeBaseRunnerStats(snapshots);

    // All slots should be empty
    rows.forEach((row) => {
      expect(row.situations.empty).toEqual([0, 0, 0]);
    });
  });
});

// ── computeBaseRunnerStatsAtBatStart ──

describe('computeBaseRunnerStatsAtBatStart', () => {
  it('uses bases at the start of each at-bat, ignoring mid-AB events', () => {
    // Snapshot sequence: PA with empty bases → stolen base → PA with runner on second.
    // At-bat-start version should treat the second PA as having no one on base (empty),
    // because the stolen base happened AFTER the first PA ended with runner on first.
    // Actually the at-bat-start version uses the basesAfter of the prior PA.
    const snapshots: PlaySnapshot[] = [
      snap({
        lineupSlot: 1,
        outsBefore: 0,
        basesBefore: bases(),
        basesAfter: bases('R'), // reached first
        isPlateAppearance: true,
      }),
      snap({
        lineupSlot: null,
        playType: 'stolen_base',
        basesBefore: bases('R'),
        basesAfter: bases(null, 'R'), // runner stole second mid-AB
        isPlateAppearance: false,
      }),
      snap({
        lineupSlot: 2,
        outsBefore: 0,
        basesBefore: bases(null, 'R'), // what the naive version sees
        basesAfter: bases(null, 'R'),
        isPlateAppearance: true,
      }),
    ];

    const atBatStart = computeBaseRunnerStatsAtBatStart(snapshots);
    const naive = computeBaseRunnerStats(snapshots);

    // Naive version: PA #2 saw runner on second.
    expect(naive.find((r) => r.lineupSlot === 2)!.situations.second[0]).toBe(1);

    // At-bat-start: PA #2 began with runner on first (basesAfter of PA #1).
    expect(atBatStart.find((r) => r.lineupSlot === 2)!.situations.first[0]).toBe(1);
  });

  it('resets the bases at the start of each new inning', () => {
    const snapshots: PlaySnapshot[] = [snap({ inning: '1st', lineupSlot: 1, basesBefore: bases(), basesAfter: bases('R') }), snap({ inning: '2nd', lineupSlot: 2, basesBefore: bases(), basesAfter: bases() })];
    const rows = computeBaseRunnerStatsAtBatStart(snapshots);

    // PA #2 should be classified as "empty" (new inning), not "first"
    expect(rows.find((r) => r.lineupSlot === 2)!.situations.empty[0]).toBe(1);
  });

  it('treats tiebreaker plays as pre-AB setup (applies to basesAfter)', () => {
    const snapshots: PlaySnapshot[] = [
      snap({
        inning: '8th',
        lineupSlot: null,
        playType: 'tiebreaker',
        basesBefore: bases(),
        basesAfter: bases(null, 'R'), // tiebreaker places runner on second
        isPlateAppearance: false,
      }),
      snap({
        inning: '8th',
        lineupSlot: 1,
        basesBefore: bases(null, 'R'),
        basesAfter: bases(null, 'R'),
        isPlateAppearance: true,
      }),
    ];
    const rows = computeBaseRunnerStatsAtBatStart(snapshots);

    expect(rows.find((r) => r.lineupSlot === 1)!.situations.second[0]).toBe(1);
  });
});

// ── mergeBaseRunnerStats ──

describe('mergeBaseRunnerStats', () => {
  it('returns 9 empty rows when merging two empty inputs', () => {
    const merged = mergeBaseRunnerStats([], []);

    expect(merged).toHaveLength(9);
    expect(merged.every((r) => Object.values(r.situations).every((o) => o.every((n) => n === 0)))).toBe(true);
  });

  it('sums counts across matching lineup slots and situations', () => {
    const a = computeBaseRunnerStats([snap({ lineupSlot: 3, outsBefore: 0, basesBefore: bases(null, 'R') })]);
    const b = computeBaseRunnerStats([snap({ lineupSlot: 3, outsBefore: 0, basesBefore: bases(null, 'R') })]);
    const merged = mergeBaseRunnerStats(a, b);

    expect(merged.find((r) => r.lineupSlot === 3)!.situations.second[0]).toBe(2);
  });

  it('does not mutate the input arrays', () => {
    const a = computeBaseRunnerStats([snap({ lineupSlot: 1, outsBefore: 0 })]);
    const b = computeBaseRunnerStats([snap({ lineupSlot: 1, outsBefore: 0 })]);
    const beforeA = a[0].situations.empty[0];
    mergeBaseRunnerStats(a, b);

    expect(a[0].situations.empty[0]).toBe(beforeA);
  });
});
