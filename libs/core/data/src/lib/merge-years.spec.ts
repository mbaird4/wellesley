import type { Roster, SeasonStats, YearBattingData, YearPitchingData, YearPlayer } from '@ws/core/models';

import { computeCareerStats, mergeBattingYears, mergePitchingYears } from './merge-years';

// ── Helpers ──

function season(overrides: Partial<SeasonStats> = {}): SeasonStats {
  return {
    year: 2025,
    name: 'Smith, Jane',
    avg: 0,
    ops: 0,
    gp: 0,
    gs: 0,
    ab: 0,
    r: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    rbi: 0,
    tb: 0,
    slg: 0,
    bb: 0,
    hbp: 0,
    so: 0,
    gdp: 0,
    obp: 0,
    sf: 0,
    sh: 0,
    sb: 0,
    sbAtt: 0,
    woba: 0,
    pa: 0,
    ...overrides,
  };
}

function yearPlayer(overrides: Partial<YearPlayer> = {}): YearPlayer {
  return {
    name: 'Jane Smith',
    jerseyNumber: 7,
    classYear: 'Senior',
    position: 'OF',
    bats: 'R',
    season: season(),
    ...overrides,
  };
}

function yearData(year: number, players: YearPlayer[], overrides: Partial<YearBattingData> = {}): YearBattingData {
  return {
    slug: 'team',
    domain: 'team.edu',
    scrapedAt: '2026-04-01',
    year,
    teamGames: 40,
    players,
    ...overrides,
  };
}

// ── mergeBattingYears ──

describe('mergeBattingYears', () => {
  it('returns an empty team when no years and no roster are provided', () => {
    const result = mergeBattingYears([]);

    expect(result.players).toEqual([]);
    expect(result.slug).toBe('');
  });

  it('merges a single year into one player per name', () => {
    const input = yearData(2025, [yearPlayer({ name: 'Jane Smith', season: season({ ab: 100, h: 30 }) }), yearPlayer({ name: 'Mary Jones', season: season({ year: 2025, name: 'Jones, Mary', ab: 50, h: 20 }) })]);
    const team = mergeBattingYears([input]);

    expect(team.players).toHaveLength(2);
    expect(team.players.map((p) => p.name).sort()).toEqual(['Jane Smith', 'Mary Jones']);
  });

  it('merges multiple seasons for the same player', () => {
    const y2024 = yearData(2024, [yearPlayer({ name: 'Jane Smith', season: season({ year: 2024, ab: 80, h: 24 }) })]);
    const y2025 = yearData(2025, [yearPlayer({ name: 'Jane Smith', season: season({ year: 2025, ab: 100, h: 35 }) })]);
    const team = mergeBattingYears([y2024, y2025]);

    expect(team.players).toHaveLength(1);
    expect(team.players[0].seasons).toHaveLength(2);
    expect(team.players[0].seasons.map((s) => s.year).sort()).toEqual([2024, 2025]);
    expect(team.players[0].career.ab).toBe(180);
    expect(team.players[0].career.h).toBe(59);
  });

  it('takes roster info (jersey, class year) from the most recent year', () => {
    const y2024 = yearData(2024, [yearPlayer({ name: 'Jane Smith', jerseyNumber: 7, classYear: 'Junior' })]);
    const y2025 = yearData(2025, [yearPlayer({ name: 'Jane Smith', jerseyNumber: 7, classYear: 'Senior' })]);
    const team = mergeBattingYears([y2024, y2025]);

    expect(team.players[0].classYear).toBe('Senior');
  });

  it('adds roster-only players (missing from batting data) with empty stats', () => {
    const roster: Roster = {
      'smith, jane': { jersey: 7, classYear: 'Senior', position: 'OF', bats: 'R', throws: 'R' },
      'rookie, riley': { jersey: 10, classYear: 'First Year', position: 'IF', bats: 'R', throws: 'R' },
    };
    const input = yearData(2025, [yearPlayer({ name: 'Jane Smith' })]);
    const team = mergeBattingYears([input], roster);

    // roster key "rookie, riley" → display name "Riley Rookie" (first last)
    const added = team.players.find((p) => p.name === 'Riley Rookie');

    expect(added).toBeDefined();
    expect(added?.seasons).toEqual([]);
    expect(added?.jerseyNumber).toBe(10);
  });

  it('title-cases multi-word roster keys when building display names', () => {
    const roster: Roster = {
      'de la rosa, sofia': { jersey: 14, classYear: 'Junior', position: 'RHP', bats: 'R', throws: 'R' },
    };
    const team = mergeBattingYears([yearData(2025, [])], roster);

    expect(team.players.find((p) => p.name === 'Sofia De La Rosa')).toBeDefined();
  });

  it('populates teamGamesByYear from each year file', () => {
    const y2024 = yearData(2024, [], { teamGames: 38 });
    const y2025 = yearData(2025, [], { teamGames: 42 });
    const team = mergeBattingYears([y2024, y2025]);

    expect(team.teamGamesByYear).toEqual({ '2024': 38, '2025': 42 });
  });

  it('sorts players by career wOBA descending', () => {
    const input = yearData(2025, [yearPlayer({ name: 'Low wOBA', season: season({ ab: 100, h: 10 }) }), yearPlayer({ name: 'High wOBA', season: season({ ab: 100, h: 50, doubles: 10, hr: 10 }) })]);
    const team = mergeBattingYears([input]);

    expect(team.players[0].name).toBe('High wOBA');
  });

  // BUG FLAG: exact-string grouping splits a player when casing differs across years.
  // The grouping key should be a normalized form (e.g., lowercased + punctuation stripped)
  // so "Grace DiBacco" in 2024 and "Grace Dibacco" in 2025 merge to one player.
  it('BUG: splits a player into two entries when casing of the name differs across years', () => {
    const y2024 = yearData(2024, [yearPlayer({ name: 'Grace DiBacco', season: season({ year: 2024, ab: 80, h: 25 }) })]);
    const y2025 = yearData(2025, [yearPlayer({ name: 'Grace Dibacco', season: season({ year: 2025, ab: 100, h: 30 }) })]);
    const team = mergeBattingYears([y2024, y2025]);

    // Current (buggy) behavior produces two rows; flip expectation after fix.
    expect(team.players.filter((p) => /dibacco/i.test(p.name))).toHaveLength(2);
  });
});

// ── computeCareerStats ──

describe('computeCareerStats', () => {
  it('returns zero rate stats for zero-AB input', () => {
    const career = computeCareerStats([]);

    expect(career.ab).toBe(0);
    expect(career.avg).toBe(0);
    expect(career.obp).toBe(0);
    expect(career.slg).toBe(0);
    expect(career.ops).toBe(0);
    expect(career.woba).toBe(0);
  });

  it('sums counting stats and derives rate stats', () => {
    const s1 = season({ ab: 40, h: 12, doubles: 2, hr: 1, bb: 5, hbp: 1, sf: 1 });
    const s2 = season({ ab: 60, h: 20, doubles: 4, hr: 2, bb: 5, hbp: 0, sf: 0 });
    const career = computeCareerStats([s1, s2]);

    expect(career.ab).toBe(100);
    expect(career.h).toBe(32);
    expect(career.doubles).toBe(6);
    expect(career.hr).toBe(3);
    expect(career.avg).toBe(0.32);
    expect(career.pa).toBe(112);
  });

  it('rounds rate stats to three decimal places', () => {
    const s = season({ ab: 3, h: 1 });
    const career = computeCareerStats([s]);

    // 1/3 = 0.333...
    expect(career.avg).toBe(0.333);
  });
});

// ── mergePitchingYears ──

describe('mergePitchingYears', () => {
  function pitchingYear(year: number, overrides: Partial<YearPitchingData> = {}): YearPitchingData {
    return {
      slug: 'team',
      domain: 'team.edu',
      scrapedAt: '2026-04-01',
      year,
      pitchingStats: [],
      games: [],
      ...overrides,
    };
  }

  it('returns an empty PitchingData for an empty input array', () => {
    const result = mergePitchingYears([]);

    expect(result.games).toEqual([]);
    expect(result.pitchingStatsByYear).toEqual({});
  });

  it('buckets pitchingStats by year and concatenates games in year order', () => {
    const y2024 = pitchingYear(2024, {
      pitchingStats: [{ name: 'P1', year: 2024 } as unknown as YearPitchingData['pitchingStats'][number]],
      games: [{ url: 'a' } as unknown as YearPitchingData['games'][number]],
    });
    const y2025 = pitchingYear(2025, {
      pitchingStats: [{ name: 'P2', year: 2025 } as unknown as YearPitchingData['pitchingStats'][number]],
      games: [{ url: 'b' } as unknown as YearPitchingData['games'][number]],
    });
    const result = mergePitchingYears([y2025, y2024]);

    expect(Object.keys(result.pitchingStatsByYear).sort()).toEqual(['2024', '2025']);
    // Games are concatenated in sorted (ascending) year order
    expect((result.games[0] as { url: string }).url).toBe('a');
    expect((result.games[1] as { url: string }).url).toBe('b');
  });
});
