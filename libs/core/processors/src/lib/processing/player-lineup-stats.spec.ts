import type { GameWithSnapshots, PlaySnapshot } from '@ws/core/models';

import { computePlayerLineupStats } from './player-lineup-stats';

function snap(overrides: Partial<PlaySnapshot> = {}): PlaySnapshot {
  return {
    playIndex: 0,
    playText: 'A. Batter singled to center.',
    playType: 'plate_appearance',
    basesBefore: { first: null, second: null, third: null },
    basesAfter: { first: 'A. Batter', second: null, third: null },
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

function game(snapshots: PlaySnapshot[]): GameWithSnapshots {
  return {
    url: 'url',
    opponent: 'Opponent',
    rows: [],
    totalPA: snapshots.filter((s) => s.isPlateAppearance).length,
    snapshots,
    baseRunnerStats: [],
    baseRunnerStatsAtBatStart: [],
  };
}

describe('computePlayerLineupStats', () => {
  it('groups casing variants of the same play-text name into one player', () => {
    const snaps = [snap({ batterName: 'G. DiBacco', playText: 'G. DiBacco singled to center.' }), snap({ batterName: 'G. Dibacco', playText: 'G. Dibacco singled to left.' })];
    const stats = computePlayerLineupStats([game(snaps)]);

    const dibaccos = stats.filter((p) => /dibacco/i.test(p.name));
    expect(dibaccos).toHaveLength(1);
    expect(dibaccos[0].totalPa).toBe(2);
  });

  it('sorts players by total PAs descending', () => {
    const snaps = [snap({ batterName: 'A. Batter', lineupSlot: 1, playText: 'A. Batter singled.' }), snap({ batterName: 'A. Batter', lineupSlot: 1, playText: 'A. Batter singled.' }), snap({ batterName: 'B. Batter', lineupSlot: 2, playText: 'B. Batter singled.' })];
    const stats = computePlayerLineupStats([game(snaps)]);

    expect(stats.map((p) => p.name)).toEqual(['A. Batter', 'B. Batter']);
  });

  it('records per-slot stats for a player who bats in multiple positions', () => {
    const snaps = [snap({ batterName: 'A. Batter', lineupSlot: 1, playText: 'A. Batter singled.' }), snap({ batterName: 'A. Batter', lineupSlot: 3, playText: 'A. Batter grounded out to ss.' })];
    const [p] = computePlayerLineupStats([game(snaps)]);

    expect(p.bySlot[0]?.stats.pa).toBe(1); // slot 1
    expect(p.bySlot[2]?.stats.pa).toBe(1); // slot 3
    expect(p.bySlot[1]).toBeNull(); // slot 2
  });
});
