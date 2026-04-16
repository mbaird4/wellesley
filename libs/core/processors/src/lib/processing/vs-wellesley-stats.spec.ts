import type { GamePbP } from '@ws/core/models';

import { computeVsWellesleyStats } from './vs-wellesley-stats';

// ── Helpers ──

function game(overrides: Partial<GamePbP> & { opponent: string }): GamePbP {
  return {
    url: 'url',
    date: '2025-03-01',
    year: 2025,
    pitchers: ['W. Pitcher'],
    battingInnings: [],
    ...overrides,
  };
}

// ── computeVsWellesleyStats ──

describe('computeVsWellesleyStats', () => {
  it('returns empty data when no games match the opponent filter', () => {
    const games = [game({ opponent: 'Other Team' })];
    const result = computeVsWellesleyStats(games, ['Target']);

    expect(result.overall).toEqual([]);
    expect(result.games).toEqual([]);
  });

  it('matches opponent names case-insensitively with whitespace trimming', () => {
    const games = [game({ opponent: '  BABSON COLLEGE  ' })];

    expect(computeVsWellesleyStats(games, ['Babson College']).games).toHaveLength(1);
  });
});

// Note: classifyOutType is not exported. Its behavior is exercised indirectly
// by the vs-Wellesley table and by the otherouts counter added in
// BatterVsStats — unrecognized out patterns now flow into `otherouts`
// instead of being silently bucketed as groundouts.
