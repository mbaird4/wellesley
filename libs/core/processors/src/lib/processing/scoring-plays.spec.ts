import type { BaseRunners, ScoringPlay } from '@ws/core/models';

import { extractScoringPlays } from './scoring-plays';

// --- Helpers ---

function makeBases(
  first: string | null = null,
  second: string | null = null,
  third: string | null = null
): BaseRunners {
  return { first, second, third };
}

/** Shorthand to call extractScoringPlays with defaults */
function extract(opts: {
  playText: string;
  playType: string;
  basesBefore?: BaseRunners;
  basesAfter?: BaseRunners;
  outsBefore?: number;
  outsAfter?: number;
  inning?: string;
  batterName?: string | null;
  lineupSlot?: number | null;
}): ScoringPlay[] {
  return extractScoringPlays(
    opts.playText,
    opts.playType,
    opts.basesBefore ?? makeBases(),
    opts.basesAfter ?? makeBases(),
    opts.outsBefore ?? 0,
    opts.outsAfter ?? 0,
    opts.inning ?? '1st',
    opts.batterName ?? 'A. Batter',
    opts.lineupSlot ?? 1
  );
}

// ============================================================
// Section F: Homer
// ============================================================

describe('extractScoringPlays — homer', () => {
  it('F1: solo homer → 1 scoring play', () => {
    const plays = extract({
      playText: 'A. Batter homered to lf.',
      playType: 'plate_appearance',
      basesBefore: makeBases(),
      basesAfter: makeBases(),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('homer');
    expect(plays[0].runnerName).toBe('A. Batter');
  });

  it('F2: 2-run homer → 2 scoring plays', () => {
    const plays = extract({
      playText: 'A. Batter homered to lf (2-run).',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'B. Runner'),
      basesAfter: makeBases(),
    });
    expect(plays).toHaveLength(2);
    expect(plays[0].scoringPlayType).toBe('homer');
    expect(plays[0].runnerName).toBe('B. Runner');
    expect(plays[1].scoringPlayType).toBe('homer');
    expect(plays[1].runnerName).toBe('A. Batter');
  });

  it('F3: 3-run homer → 3 scoring plays', () => {
    const plays = extract({
      playText: 'A. Batter homered to cf (3-run).',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First', 'C. Second'),
      basesAfter: makeBases(),
    });
    expect(plays).toHaveLength(3);
    plays.forEach((p) => expect(p.scoringPlayType).toBe('homer'));
  });

  it('F4: grand slam → 4 scoring plays', () => {
    const plays = extract({
      playText: 'A. Batter homered to rf (grand slam).',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First', 'C. Second', 'D. Third'),
      basesAfter: makeBases(),
    });
    expect(plays).toHaveLength(4);
    plays.forEach((p) => expect(p.scoringPlayType).toBe('homer'));
    // Order: runners first (first→second→third), then batter
    expect(plays[0].runnerName).toBe('B. First');
    expect(plays[1].runnerName).toBe('C. Second');
    expect(plays[2].runnerName).toBe('D. Third');
    expect(plays[3].runnerName).toBe('A. Batter');
  });

  it('F5: homer preserves inning, outs, lineupSlot metadata', () => {
    const plays = extract({
      playText: 'A. Batter homered to lf.',
      playType: 'plate_appearance',
      outsBefore: 2,
      inning: '7th',
      lineupSlot: 4,
    });
    expect(plays[0].inning).toBe('7th');
    expect(plays[0].outs).toBe(2);
    expect(plays[0].lineupSlot).toBe(4);
  });
});

// ============================================================
// Section G: Single
// ============================================================

describe('extractScoringPlays — single', () => {
  it('G1: RBI single → 1 scoring play of type single', () => {
    const plays = extract({
      playText: 'A. Batter singled to lf; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('single');
    expect(plays[0].runnerName).toBe('B. Runner');
  });

  it('G2: 2-RBI single → 2 scoring plays', () => {
    const plays = extract({
      playText: 'A. Batter singled to cf; B. Runner scored; C. Other scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'C. Other', 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(2);
    plays.forEach((p) => expect(p.scoringPlayType).toBe('single'));
  });

  it('G3: single with runner scoring on throw → single', () => {
    const plays = extract({
      playText: 'A. Batter singled to cf; B. Runner scored on the throw.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('single');
  });
});

// ============================================================
// Section H: Bunt single
// ============================================================

describe('extractScoringPlays — bunt single', () => {
  it('H1: bunt single with error-enabled scoring → type overridden to error', () => {
    const plays = extract({
      playText: 'A. Batter singled, bunt; B. Runner scored on an error by ss.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    // mapBatterResultToScoringType returns 'bunt_single',
    // but runner sub-event includes "error" → overridden to 'error'
    expect(plays[0].scoringPlayType).toBe('error');
  });

  it('H2: bunt single RBI (no error) → bunt_single', () => {
    const plays = extract({
      playText: 'A. Batter singled, bunt; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('bunt_single');
  });
});

// ============================================================
// Section I: Double
// ============================================================

describe('extractScoringPlays — double', () => {
  it('I1: standard RBI double → type double', () => {
    const plays = extract({
      playText: 'A. Batter doubled to lf; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'B. Runner'),
      basesAfter: makeBases(null, 'A. Batter'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('double');
  });

  it('I2: ground-rule double RBI → type double', () => {
    const plays = extract({
      playText: 'A. Batter doubled, ground-rule; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(null, 'A. Batter'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('double');
  });
});

// ============================================================
// Section J: Triple
// ============================================================

describe('extractScoringPlays — triple', () => {
  it('J1: 2-RBI triple → 2 scoring plays of type triple', () => {
    const plays = extract({
      playText: 'A. Batter tripled to rf; B. Runner scored; C. Other scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases('C. Other', 'B. Runner'),
      basesAfter: makeBases(null, null, 'A. Batter'),
    });
    expect(plays).toHaveLength(2);
    plays.forEach((p) => expect(p.scoringPlayType).toBe('triple'));
  });
});

// ============================================================
// Section K: Sac fly
// ============================================================

describe('extractScoringPlays — sac fly', () => {
  it('K1: standard sac fly → type sac_fly', () => {
    const plays = extract({
      playText: 'A. Batter flied out to cf, SAC; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('sac_fly');
  });

  it('K2: sac fly with runner advance + scoring', () => {
    const plays = extract({
      playText:
        'A. Batter flied out to rf, SAC; B. Runner scored; C. Other advanced to third.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'C. Other', 'B. Runner'),
      basesAfter: makeBases(null, null, 'C. Other'),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('sac_fly');
    expect(plays[0].runnerName).toBe('B. Runner');
  });

  it('K3: sacrifice fly keyword → type sac_fly', () => {
    const plays = extract({
      playText: 'A. Batter sacrifice fly to rf; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('sac_fly');
  });

  it('K4: sac fly with runner thrown out + another scoring', () => {
    const plays = extract({
      playText:
        'A. Batter flied out to cf, SAC; B. Runner scored; C. Other out at third cf to 3b.',
      playType: 'plate_appearance',
      basesBefore: makeBases('C. Other', null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 2,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('sac_fly');
    expect(plays[0].runnerName).toBe('B. Runner');
  });
});

// ============================================================
// Section L: Sac bunt
// ============================================================

describe('extractScoringPlays — sac bunt', () => {
  it('L1: sac bunt with RBI → type sac_bunt', () => {
    const plays = extract({
      playText:
        'A. Batter grounded out to p, SAC, bunt, RBI; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('sac_bunt');
  });
});

// ============================================================
// Section M: Walk
// ============================================================

describe('extractScoringPlays — walk', () => {
  it('M1: bases-loaded walk with scored text → type walk', () => {
    const plays = extract({
      playText: 'A. Batter walked; D. Third scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First', 'C. Second', 'D. Third'),
      basesAfter: makeBases('A. Batter', 'B. First', 'C. Second'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('walk');
    expect(plays[0].runnerName).toBe('D. Third');
  });

  it('M2: bases-loaded walk fallback (no "scored" text)', () => {
    // The fallback logic detects that bases were loaded and walk was issued
    const plays = extract({
      playText: 'A. Batter walked.',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First', 'C. Second', 'D. Third'),
      basesAfter: makeBases('A. Batter', 'B. First', 'C. Second'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('walk');
    expect(plays[0].runnerName).toBe('D. Third');
  });

  it('M3: non-loaded walk → 0 scoring plays', () => {
    const plays = extract({
      playText: 'A. Batter walked.',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First'),
      basesAfter: makeBases('A. Batter', 'B. First'),
    });
    expect(plays).toHaveLength(0);
  });
});

// ============================================================
// Section N: HBP
// ============================================================

describe('extractScoringPlays — HBP', () => {
  it('N1: bases-loaded HBP with scored text → type hbp', () => {
    const plays = extract({
      playText: 'A. Batter hit by pitch; D. Third scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First', 'C. Second', 'D. Third'),
      basesAfter: makeBases('A. Batter', 'B. First', 'C. Second'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('hbp');
    expect(plays[0].runnerName).toBe('D. Third');
  });

  it('N2: bases-loaded HBP fallback (no scored text)', () => {
    const plays = extract({
      playText: 'A. Batter hit by pitch.',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. First', 'C. Second', 'D. Third'),
      basesAfter: makeBases('A. Batter', 'B. First', 'C. Second'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('hbp');
    expect(plays[0].runnerName).toBe('D. Third');
  });
});

// ============================================================
// Section O: Productive out
// ============================================================

describe('extractScoringPlays — productive out', () => {
  it('O1: RBI ground out → type productive_out', () => {
    const plays = extract({
      playText: 'A. Batter grounded out to 2b; B. Runner scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('productive_out');
    expect(plays[0].runnerName).toBe('B. Runner');
  });

  it('O2: 2 runners scoring on a ground out → 2 productive_out plays', () => {
    const plays = extract({
      playText:
        'A. Batter grounded out to 1b; B. Runner scored; C. Other scored.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'C. Other', 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(2);
    plays.forEach((p) => expect(p.scoringPlayType).toBe('productive_out'));
  });

  it('O3: RBI + runner also out → 1 productive_out (out runner not scored)', () => {
    const plays = extract({
      playText:
        'A. Batter grounded out to ss; B. Runner scored; C. Other out at third ss to 3b.',
      playType: 'plate_appearance',
      basesBefore: makeBases('C. Other', null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 2,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('productive_out');
    expect(plays[0].runnerName).toBe('B. Runner');
  });

  it('O4: double play RBI → type productive_out', () => {
    const plays = extract({
      playText:
        'A. Batter grounded into double play ss to 2b to 1b; B. Runner scored; C. Other out at second ss to 2b.',
      playType: 'plate_appearance',
      basesBefore: makeBases('C. Other', null, 'B. Runner'),
      basesAfter: makeBases(),
      outsAfter: 2,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('productive_out');
  });
});

// ============================================================
// Section P: Fielder's choice
// ============================================================

describe("extractScoringPlays — fielder's choice", () => {
  it('P1: FC RBI → type fielders_choice', () => {
    const plays = extract({
      playText: "A. Batter reached on a fielder's choice; B. Runner scored.",
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('fielders_choice');
  });

  it('P2: FC with error in runner sub-event → overridden to error', () => {
    const plays = extract({
      playText:
        "A. Batter reached on a fielder's choice; B. Runner scored on an error by ss.",
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    // Runner sub-event contains "error" → overrides to 'error'
    expect(plays[0].scoringPlayType).toBe('error');
  });
});

// ============================================================
// Section Q: Error
// ============================================================

describe('extractScoringPlays — error', () => {
  it('Q1: reached on error with scoring runner → type error', () => {
    const plays = extract({
      playText:
        'A. Batter reached first on an error by ss; B. Runner scored, unearned.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    // mapBatterResultToScoringType('reached', sub, batterSub) →
    // batterSub has "error" → returns 'error'
    expect(plays[0].scoringPlayType).toBe('error');
  });

  it('Q2: error in runner sub-event overrides type', () => {
    const plays = extract({
      playText: 'A. Batter singled to cf; B. Runner scored on an error by lf.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(1);
    // Base type from batter result 'single' would be 'single',
    // but runner sub includes "error" → overridden
    expect(plays[0].scoringPlayType).toBe('error');
  });
});

// ============================================================
// Section R: Wild pitch
// ============================================================

describe('extractScoringPlays — wild pitch', () => {
  it('R1: scoring on wild pitch → type wild_pitch', () => {
    const plays = extract({
      playText: 'B. Runner scored on a wild pitch.',
      playType: 'wild_pitch',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('wild_pitch');
    expect(plays[0].runnerName).toBe('B. Runner');
    expect(plays[0].batterName).toBeNull();
  });

  it('R2: multiple runners scoring on wild pitch', () => {
    const plays = extract({
      playText:
        'B. Runner scored on a wild pitch; C. Other scored on a wild pitch.',
      playType: 'wild_pitch',
      basesBefore: makeBases(null, 'C. Other', 'B. Runner'),
      basesAfter: makeBases(),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(2);
    plays.forEach((p) => expect(p.scoringPlayType).toBe('wild_pitch'));
  });

  it('R3: wild pitch advance (no scoring) → 0 plays', () => {
    const plays = extract({
      playText: 'B. Runner advanced to second on a wild pitch.',
      playType: 'wild_pitch',
      basesBefore: makeBases('B. Runner'),
      basesAfter: makeBases(null, 'B. Runner'),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });
});

// ============================================================
// Section S: Passed ball
// ============================================================

describe('extractScoringPlays — passed ball', () => {
  it('S1: scoring on passed ball → type passed_ball', () => {
    const plays = extract({
      playText: 'B. Runner scored on a passed ball.',
      playType: 'wild_pitch', // classifyPlay returns 'wild_pitch' for both
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('passed_ball');
  });
});

// ============================================================
// Section T: Stolen base
// ============================================================

describe('extractScoringPlays — stolen base', () => {
  it('T1: steal home → type stolen_base', () => {
    const plays = extract({
      playText: 'B. Runner stole home.',
      playType: 'stolen_base',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('stolen_base');
    expect(plays[0].runnerName).toBe('B. Runner');
  });

  it('T2: steal with error scoring → type error', () => {
    const plays = extract({
      playText: 'B. Runner stole second; C. Other scored on an error by c.',
      playType: 'stolen_base',
      basesBefore: makeBases('B. Runner', null, 'C. Other'),
      basesAfter: makeBases(null, 'B. Runner'),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('error');
    expect(plays[0].runnerName).toBe('C. Other');
  });

  it('T3: state-based fallback — runner gone without text mention', () => {
    // Runner was on third before, gone after, not mentioned in text as scored/out
    const plays = extract({
      playText: 'B. Runner stole second.',
      playType: 'stolen_base',
      basesBefore: makeBases('B. Runner', null, 'C. Other'),
      basesAfter: makeBases(null, 'B. Runner'),
      batterName: null,
      lineupSlot: null,
    });
    // C. Other was on third, now gone, not in text → state-based fallback
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('stolen_base');
    expect(plays[0].runnerName).toBe('C. Other');
  });

  it('T4: steal home + "scored" text detection', () => {
    const plays = extract({
      playText: 'B. Runner stole home; B. Runner scored.',
      playType: 'stolen_base',
      basesBefore: makeBases(null, null, 'B. Runner'),
      basesAfter: makeBases(),
      batterName: null,
      lineupSlot: null,
    });
    // "stole home" detected in first sub → creates 1 play
    // "scored" in second sub → also matches, could create another
    // But the state-based fallback won't duplicate because runner is in scoredRunners
    expect(plays.length).toBeGreaterThanOrEqual(1);
    expect(plays[0].scoringPlayType).toBe('stolen_base');
  });
});

// ============================================================
// Section U: Mixed scenarios
// ============================================================

describe('extractScoringPlays — mixed scenarios', () => {
  it('U1: FC + error scoring in runner sub-event → error', () => {
    const plays = extract({
      playText:
        "A. Batter reached on a fielder's choice; B. Runner scored on an error by ss; C. Other out at second.",
      playType: 'plate_appearance',
      basesBefore: makeBases('C. Other', null, 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(1);
    expect(plays[0].scoringPlayType).toBe('error');
    expect(plays[0].runnerName).toBe('B. Runner');
  });

  it('U2: error + WP in same play — WP handler uses full playText for type (BUG)', () => {
    // When classifyPlay returns 'wild_pitch' for a play that also has error scoring,
    // the WP handler uses the full playText to determine type (wild_pitch vs passed_ball)
    // and doesn't check individual sub-events for "error"
    const plays = extract({
      playText:
        'A. Batter reached first on an error by ss; B. Runner scored on an error by ss; C. Other scored on a wild pitch.',
      playType: 'wild_pitch', // classifyPlay would return this due to "wild pitch" in text
      basesBefore: makeBases(null, 'C. Other', 'B. Runner'),
      basesAfter: makeBases('A. Batter'),
      batterName: null,
      lineupSlot: null,
    });
    // BUG: Both scoring runners get 'wild_pitch' type, even though
    // B. Runner scored on an error (should be 'error')
    expect(plays).toHaveLength(2);
    expect(plays[0].scoringPlayType).toBe('wild_pitch'); // BUG: should be 'error'
    expect(plays[1].scoringPlayType).toBe('wild_pitch');
  });
});

// ============================================================
// Section V: Non-scoring plays
// ============================================================

describe('extractScoringPlays — non-scoring', () => {
  it('V1: regular out → 0 scoring plays', () => {
    const plays = extract({
      playText: 'A. Batter grounded out to 2b.',
      playType: 'plate_appearance',
      basesBefore: makeBases(),
      basesAfter: makeBases(),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(0);
  });

  it('V2: single with no runner scoring → 0 plays', () => {
    const plays = extract({
      playText: 'A. Batter singled to cf.',
      playType: 'plate_appearance',
      basesBefore: makeBases(),
      basesAfter: makeBases('A. Batter'),
    });
    expect(plays).toHaveLength(0);
  });

  it('V3: advance only (no scoring) → 0 plays', () => {
    const plays = extract({
      playText: 'A. Batter singled to cf; B. Runner advanced to third.',
      playType: 'plate_appearance',
      basesBefore: makeBases(null, 'B. Runner'),
      basesAfter: makeBases('A. Batter', null, 'B. Runner'),
    });
    expect(plays).toHaveLength(0);
  });

  it('V4: substitution playType → 0 plays', () => {
    const plays = extract({
      playText: 'A. Pincher pinch ran for B. Original.',
      playType: 'substitution',
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });

  it('V5: defensive_change playType → 0 plays', () => {
    const plays = extract({
      playText: 'J. Colgan to p.',
      playType: 'defensive_change',
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });

  it('V6: tiebreaker playType → 0 plays', () => {
    const plays = extract({
      playText: 'A. Batter G. Runner placed on second.',
      playType: 'tiebreaker',
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });

  it('V7: no_play playType → 0 plays', () => {
    const plays = extract({
      playText: 'No play.',
      playType: 'no_play',
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });

  it('V8: wild pitch advance (no scoring) → 0 plays', () => {
    const plays = extract({
      playText: 'B. Runner advanced to second on a wild pitch.',
      playType: 'wild_pitch',
      basesBefore: makeBases('B. Runner'),
      basesAfter: makeBases(null, 'B. Runner'),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });

  it('V9: stolen base advance (no scoring) → 0 plays', () => {
    const plays = extract({
      playText: 'B. Runner stole second.',
      playType: 'stolen_base',
      basesBefore: makeBases('B. Runner'),
      basesAfter: makeBases(null, 'B. Runner'),
      batterName: null,
      lineupSlot: null,
    });
    expect(plays).toHaveLength(0);
  });

  it('V10: strikeout with runner sub-events but no scoring → 0 plays', () => {
    const plays = extract({
      playText: 'A. Batter struck out swinging; B. Runner advanced to second.',
      playType: 'plate_appearance',
      basesBefore: makeBases('B. Runner'),
      basesAfter: makeBases(null, 'B. Runner'),
      outsAfter: 1,
    });
    expect(plays).toHaveLength(0);
  });
});
