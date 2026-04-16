import type { BatHand, PitcherTrackedPlay } from '@ws/core/models';

import { computeHandednessSplits, isConferenceGame, splitBattingAvg } from './handedness-splits';

function play(overrides: Partial<PitcherTrackedPlay> = {}): PitcherTrackedPlay {
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

// ── isConferenceGame ──

describe('isConferenceGame', () => {
  it.each(['Babson', 'Clark', 'Coast Guard', 'Emerson', 'MIT', 'Mount Holyoke', 'Smith', 'Springfield', 'Wellesley', 'Wheaton', 'WPI'])('classifies %s as a NEWMAC conference game', (name) => {
    expect(isConferenceGame(name)).toBe(true);
  });

  it('matches regardless of case', () => {
    expect(isConferenceGame('wheaton')).toBe(true);
    expect(isConferenceGame('WHEATON')).toBe(true);
  });

  it('matches when the opponent name contains extra descriptors', () => {
    expect(isConferenceGame('Babson College')).toBe(true);
    expect(isConferenceGame('Wheaton Lyons')).toBe(true);
  });

  it('returns false for non-conference opponents', () => {
    expect(isConferenceGame('Tufts')).toBe(false);
    expect(isConferenceGame('Salve Regina')).toBe(false);
    expect(isConferenceGame('Curry')).toBe(false);
  });
});

// ── splitBattingAvg ──

describe('splitBattingAvg', () => {
  it('returns 0 when AB is 0', () => {
    expect(splitBattingAvg({ hand: 'R', pa: 5, ab: 0, hits: 0, singles: 0, doubles: 0, triples: 0, hr: 0, walks: 5, strikeouts: 0, hbp: 0 })).toBe(0);
  });

  it('returns hits / AB', () => {
    const stats = { hand: 'R' as BatHand, pa: 10, ab: 8, hits: 3, singles: 2, doubles: 1, triples: 0, hr: 0, walks: 2, strikeouts: 2, hbp: 0 };

    expect(splitBattingAvg(stats)).toBe(3 / 8);
  });
});

// ── computeHandednessSplits ──

describe('computeHandednessSplits', () => {
  const handednessMap = new Map<string, BatHand>([
    ['a batter', 'R'],
    ['l lefty', 'L'],
    ['s switch', 'S'],
  ]);

  it('ignores plays with a batter not in the handedness map', () => {
    const plays = [play({ batterName: 'U. Unknown', batterResult: 'single' })];

    expect(computeHandednessSplits(plays, handednessMap).size).toBe(0);
  });

  it('ignores non-PA plays', () => {
    const plays = [play({ isPlateAppearance: false })];

    expect(computeHandednessSplits(plays, handednessMap).size).toBe(0);
  });

  it('counts hits, singles, and AB for a single', () => {
    const plays = [play({ batterName: 'A. Batter', batterResult: 'single' })];
    const splits = computeHandednessSplits(plays, handednessMap);
    const r = splits.get('R')!;

    expect(r.pa).toBe(1);
    expect(r.ab).toBe(1);
    expect(r.hits).toBe(1);
    expect(r.singles).toBe(1);
  });

  it('counts doubles, triples, and homers correctly', () => {
    const plays = [play({ batterName: 'A. Batter', batterResult: 'double' }), play({ batterName: 'A. Batter', batterResult: 'triple' }), play({ batterName: 'A. Batter', batterResult: 'homer' })];
    const r = computeHandednessSplits(plays, handednessMap).get('R')!;

    expect(r.hits).toBe(3);
    expect(r.ab).toBe(3);
    expect(r.doubles).toBe(1);
    expect(r.triples).toBe(1);
    expect(r.hr).toBe(1);
  });

  it('treats walks and HBP as PAs but not ABs', () => {
    const plays = [play({ batterName: 'A. Batter', batterResult: 'walk' }), play({ batterName: 'A. Batter', batterResult: 'hbp' })];
    const r = computeHandednessSplits(plays, handednessMap).get('R')!;

    expect(r.pa).toBe(2);
    expect(r.ab).toBe(0);
    expect(r.walks).toBe(1);
    expect(r.hbp).toBe(1);
  });

  it('treats sac_bunt and sac_fly as PAs but not ABs', () => {
    const plays = [play({ batterName: 'A. Batter', batterResult: 'sac_bunt' }), play({ batterName: 'A. Batter', batterResult: 'sac_fly' })];
    const r = computeHandednessSplits(plays, handednessMap).get('R')!;

    expect(r.pa).toBe(2);
    expect(r.ab).toBe(0);
  });

  it("detects strikeouts via play text containing 'struck out'", () => {
    const plays = [play({ batterName: 'A. Batter', batterResult: 'out', playText: 'A. Batter struck out swinging.' })];
    const r = computeHandednessSplits(plays, handednessMap).get('R')!;

    expect(r.ab).toBe(1);
    expect(r.strikeouts).toBe(1);
  });

  it('splits stats by handedness when multiple batters play', () => {
    const plays = [play({ batterName: 'A. Batter', batterResult: 'single' }), play({ batterName: 'L. Lefty', batterResult: 'double' }), play({ batterName: 'S. Switch', batterResult: 'homer' })];
    const splits = computeHandednessSplits(plays, handednessMap);

    expect(splits.get('R')?.hits).toBe(1);
    expect(splits.get('L')?.doubles).toBe(1);
    expect(splits.get('S')?.hr).toBe(1);
  });

  it('normalizes batter names (lowercase, strip periods)', () => {
    // "A. Batter" → "a batter" in the map
    const plays = [play({ batterName: 'A. BATTER', batterResult: 'single' })];
    const r = computeHandednessSplits(plays, handednessMap).get('R')!;

    expect(r.hits).toBe(1);
  });
});
