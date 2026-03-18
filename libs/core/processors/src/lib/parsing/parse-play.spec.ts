import type { BaseRunners, GameState } from '@ws/core/models';

import { classifyPlay, clearBases, getPlayerNameFromText, parseBatterAction, parseRunnerSubEvent, placeOnBase, processPlay, removeFromBases } from './parse-play';

// --- Helper ---

function makeGameState(overrides?: Partial<GameState>): GameState {
  return {
    baseRunners: { first: null, second: null, third: null },
    outs: 0,
    batterIndex: 0,
    plateAppearances: new Map(),
    ...overrides,
  };
}

function makeBases(first: string | null = null, second: string | null = null, third: string | null = null): BaseRunners {
  return { first, second, third };
}

// ============================================================
// Section A: getPlayerNameFromText
// ============================================================

describe('getPlayerNameFromText', () => {
  it('A1: parses initial + last name ("A. Delgado")', () => {
    expect(getPlayerNameFromText('A. Delgado singled to cf.')).toBe('A. Delgado');
  });

  it('A2: parses full first + last name ("Andrea Delgado")', () => {
    expect(getPlayerNameFromText('Andrea Delgado struck out.')).toBe('Andrea Delgado');
  });

  it('A3: parses two-word name ("Giana Jones")', () => {
    expect(getPlayerNameFromText('Giana Jones walked.')).toBe('Giana Jones');
  });

  it('A4: parses hyphenated last name ("M. Jo-Laudat")', () => {
    expect(getPlayerNameFromText('M. Jo-Laudat doubled to lf.')).toBe('M. Jo-Laudat');
  });

  it('A5: finds name in middle of text ("/ for C. Chung")', () => {
    expect(getPlayerNameFromText('/ for C. Chung.')).toBe('C. Chung');
  });

  it('A6: returns null for single-word name ("Abernethy")', () => {
    expect(getPlayerNameFromText('Abernethy')).toBeNull();
  });

  it('A7: returns null for "Last, First" format ("Walker, Megan")', () => {
    // Comma breaks the space requirement in the regex
    expect(getPlayerNameFromText('Walker, Megan to p.')).toBeNull();
  });

  it('A8: parses multi-word last names ("A. De La Cruz")', () => {
    expect(getPlayerNameFromText('A. De La Cruz singled.')).toBe('A. De La Cruz');
  });

  it('A9: returns null for empty string', () => {
    expect(getPlayerNameFromText('')).toBeNull();
  });

  it('A10: returns null for text with no name pattern', () => {
    expect(getPlayerNameFromText('No play.')).toBeNull();
  });
});

// ============================================================
// Section B: classifyPlay
// ============================================================

describe('classifyPlay', () => {
  // --- B1: Substitutions ---
  describe('substitutions', () => {
    it('B1a: pinch hit for', () => {
      expect(classifyPlay('L. Smith pinch hit for K. Jones.')).toBe('substitution');
    });

    it('B1b: pinch ran for', () => {
      expect(classifyPlay('A. Runner pinch ran for B. Walker.')).toBe('substitution');
    });
  });

  // --- B2: Defensive changes ---
  describe('defensive changes', () => {
    it('B2a: "to p." simple position change', () => {
      expect(classifyPlay('J. Colgan to p.')).toBe('defensive_change');
    });

    it('B2b: "to 1b for" with replacement', () => {
      expect(classifyPlay('E. Kulhanek to 1b for S. Wicker.')).toBe('defensive_change');
    });

    it('B2c: "to ss" position', () => {
      expect(classifyPlay('A. Player to ss.')).toBe('defensive_change');
    });

    it('B2d: "to cf" position', () => {
      expect(classifyPlay('B. Fielder to cf.')).toBe('defensive_change');
    });

    it('B2e: "to dh" position', () => {
      expect(classifyPlay('C. Hitter to dh.')).toBe('defensive_change');
    });

    it('B2f: "to dp" position', () => {
      expect(classifyPlay('D. Player to dp.')).toBe('defensive_change');
    });
  });

  // --- B3: Defensive change false positives ---
  describe('defensive change guards', () => {
    it('B3a: "singled to p" is not a defensive change', () => {
      expect(classifyPlay('A. Batter singled to p.')).toBe('plate_appearance');
    });

    it('B3b: "doubled to rf" is not a defensive change', () => {
      expect(classifyPlay('A. Batter doubled to rf.')).toBe('plate_appearance');
    });

    it('B3c: "flied out to cf" is not a defensive change', () => {
      expect(classifyPlay('A. Batter flied out to cf.')).toBe('plate_appearance');
    });

    it('B3d: "walked" with "to p" position text is not a defensive change', () => {
      expect(classifyPlay('A. Batter walked; B. Runner advanced to second.')).toBe('plate_appearance');
    });

    it('B3e: standalone "advanced to second" → wild_pitch (runner movement, no PA)', () => {
      // Standalone runner advance (defensive indifference) routes through wild_pitch handler
      expect(classifyPlay('A. Runner advanced to second.')).toBe('wild_pitch');
    });

    it('B3f: "stole second" with position text is not a defensive change', () => {
      expect(classifyPlay('A. Runner stole second.')).toBe('stolen_base');
    });
  });

  // --- B4: Stolen bases ---
  describe('stolen bases', () => {
    it('B4a: stole second', () => {
      expect(classifyPlay('A. Runner stole second.')).toBe('stolen_base');
    });

    it('B4b: stole third', () => {
      expect(classifyPlay('A. Runner stole third.')).toBe('stolen_base');
    });

    it('B4c: stole home', () => {
      expect(classifyPlay('A. Runner stole home.')).toBe('stolen_base');
    });

    it('B4d: double steal', () => {
      expect(classifyPlay('A. Runner stole second; B. Other stole third.')).toBe('stolen_base');
    });

    it('B4e: caught stealing → stolen_base', () => {
      expect(classifyPlay('A. Runner out at second c to ss, caught stealing.')).toBe('stolen_base');
    });
  });

  // --- B5: Wild pitch / passed ball ---
  describe('wild pitch and passed ball', () => {
    it('B5a: wild pitch advance', () => {
      expect(classifyPlay('A. Runner advanced to second on a wild pitch.')).toBe('wild_pitch');
    });

    it('B5b: wild pitch scoring', () => {
      expect(classifyPlay('A. Runner scored on a wild pitch.')).toBe('wild_pitch');
    });

    it('B5c: passed ball advance', () => {
      expect(classifyPlay('A. Runner advanced to second on a passed ball.')).toBe('wild_pitch');
    });

    it('B5d: passed ball scoring', () => {
      expect(classifyPlay('A. Runner scored on a passed ball.')).toBe('wild_pitch');
    });

    it('B5e: walk + wild pitch → plate_appearance (walk is primary PA)', () => {
      expect(classifyPlay('A. Batter walked; B. Runner advanced to third on a wild pitch.')).toBe('plate_appearance');
    });

    it('B5f: struck out + wild pitch → plate_appearance (strikeout is primary PA)', () => {
      expect(classifyPlay('A. Batter struck out swinging; B. Runner scored on a wild pitch.')).toBe('plate_appearance');
    });

    it('B5g: singled + wild pitch → plate_appearance (single is primary PA)', () => {
      expect(classifyPlay('A. Batter singled to cf; B. Runner advanced to third on a wild pitch.')).toBe('plate_appearance');
    });
  });

  // --- B6: Tiebreaker ---
  describe('tiebreaker', () => {
    it('B6a: placed on second', () => {
      expect(classifyPlay('A. Batter G. Runner placed on second.')).toBe('tiebreaker');
    });

    it('B6b: placed on 2nd', () => {
      expect(classifyPlay('A. Batter G. Runner placed on 2nd.')).toBe('tiebreaker');
    });
  });

  // --- B7: No play ---
  describe('no play', () => {
    it('B7a: "No play."', () => {
      expect(classifyPlay('No play.')).toBe('no_play');
    });

    it('B7b: no play takes priority over other patterns', () => {
      // Even if other keywords exist, "no play" wins (checked first)
      expect(classifyPlay('No play. A. Runner stole second.')).toBe('no_play');
    });
  });

  // --- B8: Plate appearances ---
  describe('plate appearances', () => {
    it('B8a: singled', () => {
      expect(classifyPlay('A. Batter singled to cf.')).toBe('plate_appearance');
    });

    it('B8b: doubled', () => {
      expect(classifyPlay('A. Batter doubled to lf.')).toBe('plate_appearance');
    });

    it('B8c: tripled', () => {
      expect(classifyPlay('A. Batter tripled to rf.')).toBe('plate_appearance');
    });

    it('B8d: homered', () => {
      expect(classifyPlay('A. Batter homered to lf.')).toBe('plate_appearance');
    });

    it('B8e: struck out', () => {
      expect(classifyPlay('A. Batter struck out swinging.')).toBe('plate_appearance');
    });

    it('B8f: walked', () => {
      expect(classifyPlay('A. Batter walked.')).toBe('plate_appearance');
    });

    it('B8g: hit by pitch', () => {
      expect(classifyPlay('A. Batter hit by pitch.')).toBe('plate_appearance');
    });

    it('B8h: reached on error', () => {
      expect(classifyPlay('A. Batter reached first on an error by ss.')).toBe('plate_appearance');
    });

    it('B8i: grounded out', () => {
      expect(classifyPlay('A. Batter grounded out to 2b.')).toBe('plate_appearance');
    });

    it('B8j: flied out', () => {
      expect(classifyPlay('A. Batter flied out to cf.')).toBe('plate_appearance');
    });

    it('B8k: lined out', () => {
      expect(classifyPlay('A. Batter lined out to ss.')).toBe('plate_appearance');
    });

    it('B8l: popped up', () => {
      expect(classifyPlay('A. Batter popped up to 2b.')).toBe('plate_appearance');
    });

    it('B8m: fouled out', () => {
      expect(classifyPlay('A. Batter fouled out to 1b.')).toBe('plate_appearance');
    });

    it("B8n: fielder's choice", () => {
      expect(classifyPlay("A. Batter reached on a fielder's choice; B. Runner out at second.")).toBe('plate_appearance');
    });

    it('B8o: grounded into double play', () => {
      expect(classifyPlay('A. Batter grounded into double play ss to 2b to 1b.')).toBe('plate_appearance');
    });
  });

  // --- B9: Strikeout + stolen base ---
  describe('strikeout + stolen base', () => {
    it('B9a: struck out + stole second → plate_appearance (strikeout is primary PA)', () => {
      expect(classifyPlay('A. Batter struck out swinging; B. Runner stole second.')).toBe('plate_appearance');
    });
  });
});

// ============================================================
// Section C: parseBatterAction
// ============================================================

describe('parseBatterAction', () => {
  // --- C1: Simple outs ---
  describe('simple outs', () => {
    it('C1a: struck out swinging', () => {
      expect(parseBatterAction('A. Batter struck out swinging').result).toBe('out');
    });

    it('C1b: struck out looking', () => {
      expect(parseBatterAction('A. Batter struck out looking').result).toBe('out');
    });

    it('C1c: grounded out to 2b', () => {
      expect(parseBatterAction('A. Batter grounded out to 2b').result).toBe('out');
    });

    it('C1d: grounded out to p', () => {
      expect(parseBatterAction('A. Batter grounded out to p').result).toBe('out');
    });

    it('C1e: flied out to cf', () => {
      expect(parseBatterAction('A. Batter flied out to cf').result).toBe('out');
    });

    it('C1f: flied out to rf', () => {
      expect(parseBatterAction('A. Batter flied out to rf').result).toBe('out');
    });

    it('C1g: lined out to ss', () => {
      expect(parseBatterAction('A. Batter lined out to ss').result).toBe('out');
    });

    it('C1h: lined out to 3b', () => {
      expect(parseBatterAction('A. Batter lined out to 3b').result).toBe('out');
    });

    it('C1i: popped up to 2b', () => {
      expect(parseBatterAction('A. Batter popped up to 2b').result).toBe('out');
    });

    it('C1j: popped out to c', () => {
      expect(parseBatterAction('A. Batter popped out to c').result).toBe('out');
    });

    it('C1k: fouled out to 1b', () => {
      expect(parseBatterAction('A. Batter fouled out to 1b').result).toBe('out');
    });

    it('C1l: fouled out to c', () => {
      expect(parseBatterAction('A. Batter fouled out to c').result).toBe('out');
    });

    it('C1m: infield fly → out', () => {
      expect(parseBatterAction('A. Batter infield fly').result).toBe('out');
    });

    it('C1n: infield fly to ss → out', () => {
      expect(parseBatterAction('A. Batter infield fly to ss').result).toBe('out');
    });
  });

  // --- C2: Sac bunts ---
  describe('sac bunts', () => {
    it('C2a: "SAC, bunt" with grounded out', () => {
      const result = parseBatterAction('A. Batter grounded out to 3b, SAC, bunt');
      expect(result.result).toBe('sac_bunt');
    });

    it('C2b: "sac bunt" without comma', () => {
      const result = parseBatterAction('A. Batter grounded out to p sac bunt');
      expect(result.result).toBe('sac_bunt');
    });

    it('C2c: SAC bunt with RBI', () => {
      const result = parseBatterAction('A. Batter grounded out to p, SAC, bunt, RBI');
      expect(result.result).toBe('sac_bunt');
    });
  });

  // --- C3: SAC without bunt/fly ---
  describe('SAC without bunt or fly', () => {
    it('C3a: "grounded out, SAC" → sac_bunt (infield default)', () => {
      expect(parseBatterAction('A. Batter grounded out to 3b, SAC').result).toBe('sac_bunt');
    });

    it('C3b: "lined out to ss, SAC" → sac_bunt (ss is infield)', () => {
      expect(parseBatterAction('A. Batter lined out to ss, SAC, RBI').result).toBe('sac_bunt');
    });

    it('C3c: "fouled out to 1b, SAC, RBI" → sac_bunt (1b is infield)', () => {
      expect(parseBatterAction('A. Batter fouled out to 1b, SAC, RBI').result).toBe('sac_bunt');
    });

    it('C3d: "grounded out, SAC, RBI" → sac_bunt (ground ball sacrifice)', () => {
      expect(parseBatterAction('A. Batter grounded out to p, SAC, RBI').result).toBe('sac_bunt');
    });
  });

  // --- C4: Sac flies ---
  describe('sac flies', () => {
    it('C4a: "SAC" + flied out → sac_fly', () => {
      expect(parseBatterAction('A. Batter flied out to cf, SAC, RBI').result).toBe('sac_fly');
    });

    it('C4b: "sacrifice fly" keyword → sac_fly', () => {
      expect(parseBatterAction('A. Batter sacrifice fly to rf').result).toBe('sac_fly');
    });

    it('C4c: "sac fly" keyword → sac_fly', () => {
      expect(parseBatterAction('A. Batter sac fly to cf').result).toBe('sac_fly');
    });

    it('C4d: "SAC" + popped out → sac_fly', () => {
      expect(parseBatterAction('A. Batter popped out to c, SAC, RBI').result).toBe('sac_fly');
    });

    it('C4e: "SAC" + popped up → sac_fly', () => {
      // "popped" is matched by the /flied out|popped/ regex
      expect(parseBatterAction('A. Batter popped up to 2b, SAC').result).toBe('sac_fly');
    });
  });

  // --- C5: "out at first" pattern ---
  describe('"out at first"', () => {
    it('C5a: "out at first 1b to p" → out', () => {
      expect(parseBatterAction('A. Batter out at first 1b to p').result).toBe('out');
    });
  });

  // --- C6: Bunt singles ---
  describe('bunt singles', () => {
    it('C6a: "singled, bunt" → bunt_single', () => {
      const result = parseBatterAction('A. Batter singled, bunt');
      expect(result.result).toBe('bunt_single');
    });

    it('C6b: bunt single to location', () => {
      const result = parseBatterAction('A. Batter singled to third base, bunt');
      expect(result.result).toBe('bunt_single');
    });

    it('C6c: bunt single with advancedTo', () => {
      const result = parseBatterAction('A. Batter singled, bunt, advanced to second');
      expect(result.result).toBe('bunt_single');
      expect(result.advancedTo).toBe('second');
    });

    it('C6d: bunt single with batterAlsoOut', () => {
      const result = parseBatterAction('A. Batter singled, bunt, out at second c to ss');
      expect(result.result).toBe('bunt_single');
      expect(result.batterAlsoOut).toBe(true);
    });
  });

  // --- C7: Regular singles ---
  describe('regular singles', () => {
    it('C7a: singled to cf', () => {
      const result = parseBatterAction('A. Batter singled to cf');
      expect(result.result).toBe('single');
      expect(result.advancedTo).toBeUndefined();
    });

    it('C7b: singled to lf', () => {
      expect(parseBatterAction('A. Batter singled to lf').result).toBe('single');
    });

    it('C7c: singled to rf', () => {
      expect(parseBatterAction('A. Batter singled to rf').result).toBe('single');
    });

    it('C7d: singled to ss', () => {
      expect(parseBatterAction('A. Batter singled to ss').result).toBe('single');
    });

    it('C7e: singled with advancedTo second', () => {
      const result = parseBatterAction('A. Batter singled to lf, advanced to second');
      expect(result.result).toBe('single');
      expect(result.advancedTo).toBe('second');
    });

    it('C7f: singled with advancedTo third', () => {
      const result = parseBatterAction('A. Batter singled to cf, advanced to third');
      expect(result.result).toBe('single');
      expect(result.advancedTo).toBe('third');
    });

    it('C7g: singled with batterAlsoOut', () => {
      const result = parseBatterAction('A. Batter singled to lf, out at second lf to ss');
      expect(result.result).toBe('single');
      expect(result.batterAlsoOut).toBe(true);
    });
  });

  // --- C8: Doubles ---
  describe('doubles', () => {
    it('C8a: doubled to lf', () => {
      const result = parseBatterAction('A. Batter doubled to lf');
      expect(result.result).toBe('double');
      expect(result.advancedTo).toBeUndefined();
    });

    it('C8b: doubled to cf', () => {
      expect(parseBatterAction('A. Batter doubled to cf').result).toBe('double');
    });

    it('C8c: doubled with advancedTo third', () => {
      const result = parseBatterAction('A. Batter doubled to rf, advanced to third');
      expect(result.result).toBe('double');
      expect(result.advancedTo).toBe('third');
    });

    it('C8d: ground-rule double', () => {
      const result = parseBatterAction('A. Batter doubled, ground-rule');
      expect(result.result).toBe('double');
    });

    it('C8e: doubled with batterAlsoOut', () => {
      const result = parseBatterAction('A. Batter doubled to lf, out at third lf to 3b');
      expect(result.result).toBe('double');
      expect(result.batterAlsoOut).toBe(true);
    });
  });

  // --- C9: Triples ---
  describe('triples', () => {
    it('C9a: tripled to rf', () => {
      const result = parseBatterAction('A. Batter tripled to rf');
      expect(result.result).toBe('triple');
    });

    it('C9b: tripled to cf', () => {
      expect(parseBatterAction('A. Batter tripled to cf').result).toBe('triple');
    });

    it('C9c: tripled with batterAlsoOut', () => {
      const result = parseBatterAction('A. Batter tripled to rf, out on the play');
      expect(result.result).toBe('triple');
      expect(result.batterAlsoOut).toBe(true);
    });
  });

  // --- C10: Home runs ---
  describe('home runs', () => {
    it('C10a: homered to lf', () => {
      expect(parseBatterAction('A. Batter homered to lf').result).toBe('homer');
    });

    it('C10b: homered to cf', () => {
      expect(parseBatterAction('A. Batter homered to cf').result).toBe('homer');
    });

    it('C10c: homered (no location)', () => {
      expect(parseBatterAction('A. Batter homered').result).toBe('homer');
    });

    it('C10d: homered with RBI count', () => {
      expect(parseBatterAction('A. Batter homered to lf (2-run)').result).toBe('homer');
    });
  });

  // --- C11: Walks ---
  describe('walks', () => {
    it('C11a: walked', () => {
      expect(parseBatterAction('A. Batter walked').result).toBe('walk');
    });
  });

  // --- C12: HBP ---
  describe('hit by pitch', () => {
    it('C12a: hit by pitch', () => {
      expect(parseBatterAction('A. Batter hit by pitch').result).toBe('hbp');
    });
  });

  // --- C13: Reached on error ---
  describe('reached on error', () => {
    it('C13a: reached first on an error by ss', () => {
      const result = parseBatterAction('A. Batter reached first on an error by ss');
      expect(result.result).toBe('error');
    });

    it('C13b: reached on an error', () => {
      expect(parseBatterAction('A. Batter reached on an error by 3b').result).toBe('error');
    });
  });

  // --- C14: Fielder's choice ---
  describe("fielder's choice", () => {
    it("C14a: reached on a fielder's choice (default advancedTo first)", () => {
      const result = parseBatterAction("A. Batter reached on a fielder's choice");
      expect(result.result).toBe('fielders_choice');
      expect(result.advancedTo).toBe('first');
    });

    it('C14b: FC with advanced to second', () => {
      const result = parseBatterAction("A. Batter reached on a fielder's choice, advanced to second");
      expect(result.result).toBe('fielders_choice');
      expect(result.advancedTo).toBe('second');
    });

    it('C14c: FC with advanced to third', () => {
      const result = parseBatterAction("A. Batter reached on a fielder's choice, advanced to third");
      expect(result.result).toBe('fielders_choice');
      expect(result.advancedTo).toBe('third');
    });

    it('C14d: fielders choice (no apostrophe)', () => {
      const result = parseBatterAction('A. Batter reached on a fielders choice');
      expect(result.result).toBe('fielders_choice');
      expect(result.advancedTo).toBe('first');
    });

    it('C14e: FC with out on the play', () => {
      const result = parseBatterAction("A. Batter reached on a fielder's choice, out at second");
      expect(result.result).toBe('fielders_choice');
    });
  });

  // --- C15: Grounded into double play ---
  describe('grounded into double play', () => {
    it('C15a: grounded into double play', () => {
      expect(parseBatterAction('A. Batter grounded into double play ss to 2b to 1b').result).toBe('double_play');
    });
  });

  // --- C16: Non-grounded double plays ---
  describe('non-grounded double plays', () => {
    it('C16a: lined into double play → out', () => {
      expect(parseBatterAction('A. Batter lined into double play ss to 2b').result).toBe('out');
    });

    it('C16b: flied into double play → out', () => {
      expect(parseBatterAction('A. Batter flied into double play cf to 1b').result).toBe('out');
    });

    it('C16c: popped into double play → out', () => {
      expect(parseBatterAction('A. Batter popped into double play 2b to 1b').result).toBe('out');
    });
  });

  // --- C17: Strikeout reached first (dropped third strike) ---
  describe('strikeout reached first', () => {
    it('C17a: struck out + reached first on wild pitch → reached', () => {
      expect(parseBatterAction('A. Batter struck out swinging, reached first on a wild pitch').result).toBe('reached');
    });

    it('C17b: struck out + reached first on error → reached', () => {
      expect(parseBatterAction('A. Batter struck out swinging, reached first on an error by c').result).toBe('reached');
    });
  });

  // --- C18: Unknown patterns ---
  describe('unknown / unrecognized', () => {
    it('C18a: empty string', () => {
      expect(parseBatterAction('').result).toBe('unknown');
    });

    it('C18b: gibberish', () => {
      expect(parseBatterAction('something weird happened').result).toBe('unknown');
    });
  });

  // --- C19: Dropped foul ball (BUG) ---
  describe('dropped foul ball', () => {
    it('C19a: dropped foul ball → unknown (BUG)', () => {
      // BUG: should be 'out' or some recognized result
      expect(parseBatterAction('Dropped foul ball, A. Batter').result).toBe('unknown');
    });
  });
});

// ============================================================
// Section D: parseRunnerSubEvent
// ============================================================

describe('parseRunnerSubEvent', () => {
  // --- D1: Scored ---
  describe('scored', () => {
    it('D1a: "scored"', () => {
      const result = parseRunnerSubEvent('B. Runner scored');
      expect(result.playerName).toBe('B. Runner');
      expect(result.scored).toBe(true);
      expect(result.isOut).toBe(false);
    });

    it('D1b: "scored, unearned"', () => {
      const result = parseRunnerSubEvent('B. Runner scored, unearned');
      expect(result.scored).toBe(true);
      expect(result.isOut).toBe(false);
    });

    it('D1c: "scored on the throw"', () => {
      const result = parseRunnerSubEvent('B. Runner scored on the throw');
      expect(result.scored).toBe(true);
    });

    it('D1d: "scored on an error by ss"', () => {
      const result = parseRunnerSubEvent('B. Runner scored on an error by ss');
      expect(result.scored).toBe(true);
      expect(result.isOut).toBe(false);
    });
  });

  // --- D2: Out ---
  describe('out', () => {
    it('D2a: "out at second"', () => {
      const result = parseRunnerSubEvent('B. Runner out at second c to ss');
      expect(result.isOut).toBe(true);
      expect(result.scored).toBe(false);
    });

    it('D2b: "out at third"', () => {
      const result = parseRunnerSubEvent('B. Runner out at third');
      expect(result.isOut).toBe(true);
    });

    it('D2c: "out at home"', () => {
      const result = parseRunnerSubEvent('B. Runner out at home lf to c');
      expect(result.isOut).toBe(true);
    });

    it('D2d: "out on the play"', () => {
      const result = parseRunnerSubEvent('B. Runner out on the play');
      expect(result.isOut).toBe(true);
    });

    it('D2e: "caught stealing"', () => {
      const result = parseRunnerSubEvent('B. Runner caught stealing second');
      expect(result.isOut).toBe(true);
      expect(result.scored).toBe(false);
    });

    it('D2f: "picked off"', () => {
      const result = parseRunnerSubEvent('B. Runner picked off');
      expect(result.isOut).toBe(true);
    });
  });

  // --- D3: Advanced ---
  describe('advanced', () => {
    it('D3a: "advanced to second"', () => {
      const result = parseRunnerSubEvent('B. Runner advanced to second');
      expect(result.advancedTo).toBe('second');
      expect(result.isOut).toBe(false);
      expect(result.scored).toBe(false);
    });

    it('D3b: "advanced to third"', () => {
      const result = parseRunnerSubEvent('B. Runner advanced to third');
      expect(result.advancedTo).toBe('third');
    });

    it('D3c: "advanced to 2b" (numeric base)', () => {
      const result = parseRunnerSubEvent('B. Runner advanced to 2b');
      expect(result.advancedTo).toBe('second');
    });

    it('D3d: "advanced to 3b" (numeric base)', () => {
      const result = parseRunnerSubEvent('B. Runner advanced to 3b');
      expect(result.advancedTo).toBe('third');
    });
  });

  // --- D4: Combined / priority ---
  describe('combined events — out takes priority over scored', () => {
    it('D4a: "out at home" takes priority (out checked before scored)', () => {
      // "out at" is checked before "scored"
      const result = parseRunnerSubEvent('B. Runner advanced to third, out at home c to p');
      expect(result.isOut).toBe(true);
      expect(result.scored).toBe(false);
    });

    it('D4b: "scored on error" → scored (no out keyword)', () => {
      const result = parseRunnerSubEvent('B. Runner advanced to third, scored on error');
      // No "out at" / "caught stealing" / etc → falls to "scored" check
      expect(result.scored).toBe(true);
      expect(result.isOut).toBe(false);
    });
  });

  // --- D5: No name ---
  describe('no identifiable player', () => {
    it('D5a: returns null playerName for unrecognizable text', () => {
      const result = parseRunnerSubEvent('scored');
      expect(result.playerName).toBeNull();
      expect(result.scored).toBe(true);
    });
  });
});

// ============================================================
// Section E: processPlay integration
// ============================================================

describe('processPlay', () => {
  // --- E1: Simple strikeout ---
  it('E1: strikeout increments outs and batterIndex', () => {
    const state = makeGameState();
    processPlay('A. Batter struck out swinging.', state);
    expect(state.outs).toBe(1);
    expect(state.batterIndex).toBe(1);
    expect(state.baseRunners).toEqual(makeBases());
    // PA recorded at slot 1, 0 outs
    expect(state.plateAppearances.get(1)).toEqual([1, 0, 0]);
  });

  // --- E2: Single with runner advance ---
  it('E2: single places batter on first, runner advances', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('A. Batter singled to cf; B. Runner advanced to third.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.baseRunners.third).toBe('B. Runner');
    expect(state.outs).toBe(0);
    expect(state.batterIndex).toBe(1);
  });

  // --- E3: Single with RBI ---
  it('E3: single with RBI removes scored runner from bases', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, null, 'B. Runner'),
    });
    processPlay('A. Batter singled to lf; B. Runner scored.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.baseRunners.third).toBeNull();
    expect(state.batterIndex).toBe(1);
  });

  // --- E4: Solo homer ---
  it('E4: solo homer clears bases', () => {
    const state = makeGameState();
    processPlay('A. Batter homered to lf.', state);
    expect(state.baseRunners).toEqual(makeBases());
    expect(state.outs).toBe(0);
    expect(state.batterIndex).toBe(1);
  });

  // --- E5: 2-run homer ---
  it('E5: 2-run homer clears bases', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, 'B. Runner'),
    });
    processPlay('A. Batter homered to cf (2-run).', state);
    expect(state.baseRunners).toEqual(makeBases());
    expect(state.batterIndex).toBe(1);
  });

  // --- E6: 3-run homer ---
  it('E6: 3-run homer clears bases', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner', 'C. Other'),
    });
    processPlay('A. Batter homered to lf (3-run).', state);
    expect(state.baseRunners).toEqual(makeBases());
  });

  // --- E7: Walk (simple) ---
  it('E7: walk places batter on first', () => {
    const state = makeGameState();
    processPlay('A. Batter walked.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.outs).toBe(0);
    expect(state.batterIndex).toBe(1);
  });

  // --- E8: Walk bases loaded ---
  it('E8: bases-loaded walk forces run, batter goes to first', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. First', 'C. Second', 'D. Third'),
    });
    processPlay('A. Batter walked; D. Third scored.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    // D. Third scored and was removed
    expect(state.baseRunners.third).toBeNull();
    expect(state.batterIndex).toBe(1);
  });

  // --- E9: Sac bunt ---
  it('E9: sac bunt adds an out, runner advances', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('A. Batter grounded out to 3b, SAC, bunt; B. Runner advanced to second.', state);
    expect(state.outs).toBe(1);
    expect(state.baseRunners.first).toBeNull();
    expect(state.baseRunners.second).toBe('B. Runner');
    expect(state.batterIndex).toBe(1);
  });

  // --- E10: Sac fly ---
  it('E10: sac fly adds an out, runner scores', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, null, 'B. Runner'),
    });
    processPlay('A. Batter flied out to cf, SAC; B. Runner scored.', state);
    expect(state.outs).toBe(1);
    expect(state.baseRunners.third).toBeNull();
    expect(state.batterIndex).toBe(1);
  });

  // --- E11: Double play ---
  it('E11: double play adds 2 outs (1 from DP + 1 from runner)', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('A. Batter grounded into double play ss to 2b to 1b; B. Runner out at second ss to 2b.', state);
    // 1 from double_play + 1 from runner sub-event
    expect(state.outs).toBe(2);
    expect(state.baseRunners.first).toBeNull();
  });

  // --- E12: Fielder's choice ---
  it('E12: FC places batter on first, runner out', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay("A. Batter reached on a fielder's choice; B. Runner out at second ss to 2b.", state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.outs).toBe(1);
    expect(state.batterIndex).toBe(1);
  });

  // --- E13: Stolen base (no batterIndex change) ---
  it('E13: stolen base does not change batterIndex', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('B. Runner stole second.', state);
    expect(state.batterIndex).toBe(0);
    expect(state.baseRunners.first).toBeNull();
    expect(state.baseRunners.second).toBe('B. Runner');
  });

  // --- E14: Double steal ---
  it('E14: double steal advances both runners', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner', 'C. Other'),
    });
    processPlay('B. Runner stole second; C. Other stole third.', state);
    // Wait: B. Runner was on first, stole second. C. Other was on second, stole third.
    // But B. Runner "stole second" → remove from bases (was on first), place on second.
    // C. Other "stole third" → remove from bases (was on second), place on third.
    expect(state.baseRunners.first).toBeNull();
    expect(state.baseRunners.second).toBe('B. Runner');
    expect(state.baseRunners.third).toBe('C. Other');
    expect(state.batterIndex).toBe(0);
  });

  // --- E15: Steal home ---
  it('E15: steal home removes runner from bases', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, null, 'B. Runner'),
    });
    processPlay('B. Runner stole home.', state);
    expect(state.baseRunners.third).toBeNull();
    expect(state.batterIndex).toBe(0);
  });

  // --- E16: Wild pitch advance ---
  it('E16: wild pitch advances runner', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('B. Runner advanced to second on a wild pitch.', state);
    expect(state.baseRunners.first).toBeNull();
    expect(state.baseRunners.second).toBe('B. Runner');
    expect(state.batterIndex).toBe(0);
  });

  // --- E17: Wild pitch scoring ---
  it('E17: wild pitch scoring removes runner', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, null, 'B. Runner'),
    });
    processPlay('B. Runner scored on a wild pitch.', state);
    expect(state.baseRunners.third).toBeNull();
  });

  // --- E18: Caught stealing ---
  it('E18: caught stealing removes runner and records out', () => {
    const state = makeGameState({
      baseRunners: makeBases('A. Runner'),
    });
    processPlay('A. Runner out at second c to ss, caught stealing.', state);
    expect(state.batterIndex).toBe(0); // no PA
    expect(state.outs).toBe(1);
    expect(state.baseRunners.first).toBeNull();
  });

  // --- E19: Tiebreaker ---
  it('E19: tiebreaker places runner on second', () => {
    const state = makeGameState();
    processPlay('A. Batter G. Runner placed on second.', state);
    expect(state.baseRunners.second).toBe('G. Runner');
    expect(state.batterIndex).toBe(0); // no PA
  });

  // --- E20: Pinch runner ---
  it('E20: pinch runner replaces runner on base', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, 'B. Original'),
    });
    processPlay('A. Pincher pinch ran for B. Original.', state);
    expect(state.baseRunners.second).toBe('A. Pincher');
    expect(state.batterIndex).toBe(0); // no PA
  });

  // --- E21: Defensive change (no-op) ---
  it('E21: defensive change has no effect on game state', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
      outs: 1,
      batterIndex: 3,
    });
    processPlay('J. Colgan to p.', state);
    expect(state.baseRunners.first).toBe('B. Runner');
    expect(state.outs).toBe(1);
    expect(state.batterIndex).toBe(3);
  });

  // --- E22: Inning end (3 outs resets) ---
  it('E22: reaching 3 outs clears bases and resets outs, batterIndex persists', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner', 'C. Other'),
      outs: 2,
      batterIndex: 4,
    });
    processPlay('A. Batter struck out swinging.', state);
    // 2 + 1 = 3 outs → inning end
    expect(state.outs).toBe(0);
    expect(state.baseRunners).toEqual(makeBases());
    expect(state.batterIndex).toBe(5); // persists
  });

  // --- E23: Batter thrown out after hit ---
  it('E23: batter singled then thrown out at second', () => {
    const state = makeGameState();
    processPlay('A. Batter singled to lf, out at second lf to ss.', state);
    // parseBatterAction → single, batterAlsoOut=true
    // Places on first, then removeFromBases + outs+=1
    expect(state.baseRunners.first).toBeNull();
    expect(state.outs).toBe(1);
    expect(state.batterIndex).toBe(1);
  });

  // --- E24: Strikeout + caught stealing in same play ---
  it('E24: strikeout + caught stealing in runner sub-event', () => {
    // Note: if the text has "caught stealing" but NOT "stole X",
    // classifyPlay returns 'plate_appearance' (which is correct for the strikeout)
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('A. Batter struck out swinging; B. Runner out at second c to ss, caught stealing.', state);
    expect(state.batterIndex).toBe(1);
    expect(state.outs).toBe(2); // 1 strikeout + 1 runner out
    expect(state.baseRunners.first).toBeNull();
  });

  // --- E25: Strikeout + stolen base ---
  it('E25: struck out + stole second → PA recorded, runner advances', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
    });
    processPlay('A. Batter struck out swinging; B. Runner stole second.', state);
    expect(state.batterIndex).toBe(1);
    expect(state.outs).toBe(1);
    expect(state.baseRunners.second).toBe('B. Runner');
  });

  // --- E26: PA recording at correct out count ---
  it('E26: PA is recorded at the out count BEFORE the play modifies outs', () => {
    const state = makeGameState({ outs: 1, batterIndex: 0 });
    processPlay('A. Batter grounded out to 2b.', state);
    // PA recorded at 1-out column before outs incremented
    expect(state.plateAppearances.get(1)).toEqual([0, 1, 0]);
    expect(state.outs).toBe(2);
  });

  // --- E27: batterIndex cycles mod 9 for lineup slot ---
  it('E27: batterIndex 8 maps to slot 9, then wraps to slot 1', () => {
    const state = makeGameState({ batterIndex: 8 });
    processPlay('A. Batter struck out swinging.', state);
    expect(state.plateAppearances.get(9)).toEqual([1, 0, 0]);

    processPlay('B. Batter struck out looking.', state);
    expect(state.plateAppearances.get(1)).toEqual([0, 1, 0]);
    expect(state.batterIndex).toBe(10);
  });

  // --- E28: No play ---
  it('E28: "No play." has no effect', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. Runner'),
      outs: 1,
      batterIndex: 3,
    });
    processPlay('No play.', state);
    expect(state.baseRunners.first).toBe('B. Runner');
    expect(state.outs).toBe(1);
    expect(state.batterIndex).toBe(3);
  });

  // --- E29: Double with advance to third ---
  it('E29: double with advance to third places batter on third', () => {
    const state = makeGameState();
    processPlay('A. Batter doubled to cf, advanced to third.', state);
    expect(state.baseRunners.third).toBe('A. Batter');
    expect(state.baseRunners.second).toBeNull();
  });

  // --- E30: Triple places batter on third ---
  it('E30: triple places batter on third', () => {
    const state = makeGameState();
    processPlay('A. Batter tripled to rf.', state);
    expect(state.baseRunners.third).toBe('A. Batter');
  });

  // --- E31: HBP places batter on first ---
  it('E31: hit by pitch places batter on first', () => {
    const state = makeGameState();
    processPlay('A. Batter hit by pitch.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.batterIndex).toBe(1);
  });

  // --- E32: Error places batter on first ---
  it('E32: reached on error places batter on first', () => {
    const state = makeGameState();
    processPlay('A. Batter reached first on an error by ss.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.batterIndex).toBe(1);
  });

  // --- E33: Passed ball advance ---
  it('E33: passed ball advances runner', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, 'B. Runner'),
    });
    processPlay('B. Runner advanced to third on a passed ball.', state);
    expect(state.baseRunners.second).toBeNull();
    expect(state.baseRunners.third).toBe('B. Runner');
    expect(state.batterIndex).toBe(0);
  });

  // --- E34: Multiple runner sub-events ---
  it('E34: single with two runners advancing/scoring', () => {
    const state = makeGameState({
      baseRunners: makeBases('B. First', 'C. Second'),
    });
    processPlay('A. Batter singled to cf; B. First advanced to second; C. Second scored.', state);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.baseRunners.second).toBe('B. First');
    expect(state.baseRunners.third).toBeNull();
    expect(state.outs).toBe(0);
  });

  // --- E35: Walk + wild pitch ---
  it('E35: walk + wild pitch → PA recorded, batter on first, runner advances', () => {
    const state = makeGameState({
      baseRunners: makeBases(null, 'B. Runner'),
    });
    processPlay('A. Batter walked; B. Runner advanced to third on a wild pitch.', state);
    expect(state.batterIndex).toBe(1);
    expect(state.baseRunners.first).toBe('A. Batter');
    expect(state.baseRunners.third).toBe('B. Runner');
  });
});

// ============================================================
// Base runner utilities (quick sanity)
// ============================================================

describe('base runner utilities', () => {
  it('removeFromBases clears the correct base', () => {
    const bases = makeBases('A. Player', 'B. Player', 'C. Player');
    removeFromBases(bases, 'B. Player');
    expect(bases.second).toBeNull();
    expect(bases.first).toBe('A. Player');
    expect(bases.third).toBe('C. Player');
  });

  it('placeOnBase removes from old base first', () => {
    const bases = makeBases('A. Player');
    placeOnBase(bases, 'A. Player', 'second');
    expect(bases.first).toBeNull();
    expect(bases.second).toBe('A. Player');
  });

  it('clearBases clears all bases', () => {
    const bases = makeBases('A. Player', 'B. Player', 'C. Player');
    clearBases(bases);
    expect(bases).toEqual(makeBases());
  });
});
