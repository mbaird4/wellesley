import type { BaseRunners, BatterResult, GameState, PlayType } from '@ws/core/models';

// Regex that handles initials ("A. Delgado"), multi-char abbreviations ("Ma. Bowen"),
// full names ("Andrea Delgado"), hyphenated names ("M. Jo-Laudat"), and multi-word last names
const NAME_PATTERN = /([A-Z](?:[a-z]*\.|[a-zA-Z]+)\s+[A-Z][a-zA-Z]+(?:-[A-Za-z]+)*(?:\s+[A-Z][a-zA-Z]+(?:-[A-Za-z]+)*)*)/;

// --- Name utilities ---

export function getPlayerNameFromText(text: string): string | null {
  const match = text.match(NAME_PATTERN);

  return match ? match[1] : null;
}

/**
 * Check whether lowercased play text contains any plate-appearance verb
 * (both Sidearm Sports past-tense and GameChanger present-tense formats).
 * Used by classifyPlay to avoid misclassifying PAs as non-PA events.
 */
function containsPaVerb(lower: string): boolean {
  return lower.includes('singled') || lower.includes('singles') || lower.includes('doubled') || lower.includes('doubles') || lower.includes('tripled') || lower.includes('triples') || lower.includes('homered') || lower.includes('homers') || lower.includes('walked') || /\bwalks\b/.test(lower) || lower.includes('struck out') || lower.includes('strikes out') || lower.includes('grounded') || lower.includes('grounds out') || lower.includes('grounds into') || lower.includes('flied') || lower.includes('flies out') || lower.includes('lined') || lower.includes('lines out') || lower.includes('lines into') || lower.includes('popped') || lower.includes('pops out') || lower.includes('pops up') || lower.includes('pops into') || lower.includes('fouled') || lower.includes('fouls out') || lower.includes('fouls into') || lower.includes('reached') || lower.includes('reaches on') || lower.includes('hit by pitch') || lower.includes('infield fly') || lower.includes('interference');
}

// --- Play classification ---

export function classifyPlay(text: string): PlayType {
  const lower = text.toLowerCase();

  if (lower.includes('no play')) {
    return 'no_play';
  }

  // True no-play events (no state change)
  if (lower.startsWith('/ ')) {
    return 'no_play';
  } // "/ for PLAYER." substitution artifact

  if (lower.includes('foul ball')) {
    return 'no_play';
  }

  if (lower.includes('runner left early')) {
    return 'no_play';
  }

  if (lower.includes('did not advance') && !lower.includes(';')) {
    return 'no_play';
  }

  if (lower.includes('pinch hit for') || lower.includes('pinch ran for')) {
    return 'substitution';
  }

  // Defensive changes: "J. Colgan to p." or "E. Kulhanek to 1b for S. Wicker."
  if (/\bto\s+(p|c|1b|2b|3b|ss|lf|cf|rf|dh|dp)\b/i.test(lower) && !lower.includes('advanced to')) {
    if (!containsPaVerb(lower) && !lower.includes('stole') && !lower.includes('out at')) {
      return 'defensive_change';
    }
  }

  // Stolen base / caught stealing — but not if a PA verb is present
  if (/\bstole\s+(second|third|home|2nd|3rd)\b/i.test(lower) || lower.includes('caught stealing')) {
    if (!containsPaVerb(lower)) {
      return 'stolen_base';
    }
  }

  // Wild pitch / passed ball — but not if a PA verb is present
  if (lower.includes('wild pitch') || lower.includes('passed ball')) {
    if (!containsPaVerb(lower)) {
      return 'wild_pitch';
    }
  }

  if (lower.includes('placed on second') || lower.includes('placed on 2nd')) {
    return 'tiebreaker';
  }

  // Standalone runner events — no PA, but need runner movement processing
  // (defensive indifference, errors, etc.) Route through wild_pitch handler.
  if (/^[A-Z](?:\.|[a-zA-Z]+)\s+\S+\s+(advanced|scored)\b/.test(text) && !containsPaVerb(lower)) {
    return 'wild_pitch';
  }

  return 'plate_appearance';
}

// --- Batter action parsing ---

export function parseBatterAction(subEvent: string): {
  result: BatterResult;
  advancedTo?: 'first' | 'second' | 'third';
  batterAlsoOut?: boolean;
} {
  const lower = subEvent.toLowerCase();

  // Sac plays — must check before generic outs since text also contains "flied out", "grounded out", etc.
  if (lower.includes('sac fly') || lower.includes('sacrifice fly')) {
    return { result: 'sac_fly' };
  }

  if (lower.includes('sac bunt')) {
    return { result: 'sac_bunt' };
  }

  if (/\bsac\b/.test(lower) && /\bbunt\b/.test(lower)) {
    return { result: 'sac_bunt' };
  }

  if (/\bsac\b/.test(lower) && /flied out|popped/.test(lower)) {
    return { result: 'sac_fly' };
  }

  // SAC without explicit bunt/fly — infer from fielder position
  if (/\bsac\b/i.test(lower) && !lower.includes('sac fly') && !lower.includes('sacrifice fly')) {
    if (/\b(lf|cf|rf)\b/.test(lower)) {
      return { result: 'sac_fly' };
    }

    return { result: 'sac_bunt' }; // infield default
  }

  // Interference — batter is out, counts as AB
  if (lower.includes('interference')) {
    return { result: 'out' };
  }

  // Outs (both Sidearm past-tense and GameChanger present-tense)
  if (lower.includes('struck out') || lower.includes('strikes out')) {
    // Dropped third strike — batter reaches first
    if (lower.includes('reached first') || lower.includes('reaches first')) {
      return { result: 'reached' };
    }

    return { result: 'out' };
  }

  if (lower.includes('infield fly')) {
    return { result: 'out' };
  }

  if (/\b(lined|popped|flied|fouled|lines|pops|flies|fouls) into double play\b/.test(lower)) {
    return { result: 'out' };
  }

  if (lower.includes('grounded into double play') || lower.includes('grounds into double play')) {
    return { result: 'double_play' };
  }

  if (lower.includes('out at first')) {
    return { result: 'out' };
  }

  if (lower.includes('grounded out') || lower.includes('grounds out')) {
    return { result: 'out' };
  }

  if (lower.includes('flied out') || lower.includes('flies out')) {
    return { result: 'out' };
  }

  if (lower.includes('lined out') || lower.includes('lines out')) {
    return { result: 'out' };
  }

  if (lower.includes('popped up') || lower.includes('pops up')) {
    return { result: 'out' };
  }

  if (lower.includes('popped out') || lower.includes('pops out')) {
    return { result: 'out' };
  }

  if (lower.includes('fouled out') || lower.includes('fouls out')) {
    return { result: 'out' };
  }

  // Fielder's choice — batter reaches, someone else is out
  if (lower.includes("fielder's choice") || lower.includes('fielders choice')) {
    let advancedTo: 'first' | 'second' | 'third' = 'first';
    if (lower.includes('advanced to third')) {
      advancedTo = 'third';
    } else if (lower.includes('advanced to second')) {
      advancedTo = 'second';
    }

    return { result: 'fielders_choice', advancedTo };
  }

  // Hits
  // Check if batter was also thrown out on the bases (e.g. "singled, out at second c to p to 1b")
  const batterAlsoOut = /\bout at\b/.test(lower) || lower.includes('out on the play');

  if (lower.includes('homered') || /\bhomers\b/.test(lower)) {
    return { result: 'homer' };
  }

  if (lower.includes('tripled') || /\btriples\b/.test(lower)) {
    return { result: 'triple', batterAlsoOut: batterAlsoOut || undefined };
  }

  if (lower.includes('doubled') || /\bdoubles\b/.test(lower)) {
    let advancedTo: 'second' | 'third' | undefined = undefined;
    if (lower.includes('advanced to third')) {
      advancedTo = 'third';
    }

    return {
      result: 'double',
      advancedTo,
      batterAlsoOut: batterAlsoOut || undefined,
    };
  }

  if (lower.includes('singled') || /\bsingles\b/.test(lower)) {
    let advancedTo: 'first' | 'second' | 'third' | undefined = undefined;
    if (lower.includes('advanced to third')) {
      advancedTo = 'third';
    } else if (lower.includes('advanced to second')) {
      advancedTo = 'second';
    }

    if (/\bbunt\b/i.test(lower)) {
      return {
        result: 'bunt_single',
        advancedTo,
        batterAlsoOut: batterAlsoOut || undefined,
      };
    }

    return {
      result: 'single',
      advancedTo,
      batterAlsoOut: batterAlsoOut || undefined,
    };
  }

  // Walks / HBP / reached
  if (lower.includes('walked') || /\bwalks\b/.test(lower)) {
    return { result: 'walk' };
  }

  if (lower.includes('hit by pitch')) {
    return { result: 'hbp' };
  }

  if (lower.includes('reached on') || lower.includes('reached first') || lower.includes('reaches on') || lower.includes('reaches first')) {
    if (lower.includes('error')) {
      return { result: 'error' };
    }

    return { result: 'reached' };
  }

  return { result: 'unknown' };
}

// --- Runner sub-event parsing ---

interface RunnerSubEventResult {
  playerName: string | null;
  isOut: boolean;
  scored: boolean;
  advancedTo?: 'first' | 'second' | 'third';
}

export function parseRunnerSubEvent(subEvent: string): RunnerSubEventResult {
  const playerName = getPlayerNameFromText(subEvent);
  const lower = subEvent.toLowerCase();

  if (lower.includes('out at') || lower.includes('out on the play') || lower.includes('picked off') || lower.includes('caught stealing')) {
    return { playerName, isOut: true, scored: false };
  }

  if (lower.includes('scored')) {
    return { playerName, isOut: false, scored: true };
  }

  const advMatch = lower.match(/advanced\s+to\s+(first|second|third|1b|2b|3b)/);
  if (advMatch) {
    const base = normalizeBase(advMatch[1]);

    return { playerName, isOut: false, scored: false, advancedTo: base };
  }

  // Stolen bases as runner sub-events (e.g. "B. Runner stole second")
  if (lower.includes('stole home')) {
    return { playerName, isOut: false, scored: true };
  }

  const stoleMatch = lower.match(/\bstole\s+(second|third|2nd|3rd)\b/);
  if (stoleMatch) {
    const base = normalizeBase(stoleMatch[1]);

    return { playerName, isOut: false, scored: false, advancedTo: base };
  }

  return { playerName, isOut: false, scored: false };
}

function normalizeBase(base: string): 'first' | 'second' | 'third' {
  const b = base.toLowerCase();
  if (b === 'first' || b === '1b') {
    return 'first';
  }

  if (b === 'second' || b === '2b') {
    return 'second';
  }

  return 'third';
}

// --- Base runner management ---

export function removeFromBases(bases: BaseRunners, playerName: string): void {
  if (bases.first === playerName) {
    bases.first = null;
  }

  if (bases.second === playerName) {
    bases.second = null;
  }

  if (bases.third === playerName) {
    bases.third = null;
  }
}

export function placeOnBase(bases: BaseRunners, playerName: string, base: 'first' | 'second' | 'third'): void {
  removeFromBases(bases, playerName);
  bases[base] = playerName;
}

export function clearBases(bases: BaseRunners): void {
  bases.first = null;
  bases.second = null;
  bases.third = null;
}

// --- Main play processor ---

export function processPlay(playText: string, gameState: GameState): void {
  const playType = classifyPlay(playText);

  switch (playType) {
    case 'defensive_change':
    case 'no_play':
      return;

    case 'substitution':
      handleSubstitution(playText, gameState);

      return;

    case 'stolen_base':
      handleStolenBase(playText, gameState);

      return;

    case 'wild_pitch':
      handleWildPitchOrPassedBall(playText, gameState);

      return;

    case 'tiebreaker':
      handleTiebreaker(playText, gameState);

      return;

    case 'plate_appearance':
      handlePlateAppearance(playText, gameState);

      return;
  }
}

// --- Non-PA event handlers ---

function handleSubstitution(playText: string, gameState: GameState): void {
  const pinchRunMatch = playText.match(new RegExp(`${NAME_PATTERN.source}\\s+pinch ran for\\s+${NAME_PATTERN.source}`, 'i'));
  if (pinchRunMatch) {
    const newRunner = pinchRunMatch[1];
    const oldRunner = pinchRunMatch[2];
    if (gameState.baseRunners.first === oldRunner) {
      gameState.baseRunners.first = newRunner;
    }

    if (gameState.baseRunners.second === oldRunner) {
      gameState.baseRunners.second = newRunner;
    }

    if (gameState.baseRunners.third === oldRunner) {
      gameState.baseRunners.third = newRunner;
    }
  }
}

function handleStolenBase(playText: string, gameState: GameState): void {
  const subEvents = playText
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim());
  subEvents.forEach((sub) => {
    const playerName = getPlayerNameFromText(sub);

    if (!playerName) {
      return;
    }

    const lower = sub.toLowerCase();

    if (lower.includes('out at') || lower.includes('caught stealing')) {
      removeFromBases(gameState.baseRunners, playerName);
      gameState.outs += 1;
    } else if (lower.includes('stole home') || lower.includes('scored')) {
      removeFromBases(gameState.baseRunners, playerName);
    } else if (lower.includes('stole third') || lower.includes('stole 3rd')) {
      removeFromBases(gameState.baseRunners, playerName);
      placeOnBase(gameState.baseRunners, playerName, 'third');
    } else if (lower.includes('stole second') || lower.includes('stole 2nd')) {
      removeFromBases(gameState.baseRunners, playerName);
      placeOnBase(gameState.baseRunners, playerName, 'second');
    } else if (lower.includes('advanced to third')) {
      removeFromBases(gameState.baseRunners, playerName);
      placeOnBase(gameState.baseRunners, playerName, 'third');
    } else if (lower.includes('advanced to second')) {
      removeFromBases(gameState.baseRunners, playerName);
      placeOnBase(gameState.baseRunners, playerName, 'second');
    }
  });

  checkInningEnd(gameState);
}

function handleWildPitchOrPassedBall(playText: string, gameState: GameState): void {
  const subEvents = playText
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim());

  subEvents.forEach((sub) => {
    const result = parseRunnerSubEvent(sub);

    if (!result.playerName) {
      return;
    }

    if (result.isOut) {
      removeFromBases(gameState.baseRunners, result.playerName);
      gameState.outs += 1;
    } else if (result.scored) {
      removeFromBases(gameState.baseRunners, result.playerName);
    } else if (result.advancedTo) {
      placeOnBase(gameState.baseRunners, result.playerName, result.advancedTo);
    }
  });

  checkInningEnd(gameState);
}

function handleTiebreaker(playText: string, gameState: GameState): void {
  // Must match the name directly before "placed on" to avoid grabbing
  // the batter name that precedes it (e.g. "D. Borrison G. Jones placed on second.")
  const match = playText.match(new RegExp(`${NAME_PATTERN.source}\\s+placed on (?:second|2nd)`));
  if (match) {
    placeOnBase(gameState.baseRunners, match[1], 'second');
  }
}

// --- Plate appearance handler (core logic) ---

function handlePlateAppearance(playText: string, gameState: GameState): void {
  const subEvents = playText
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim());

  const batterSubEvent = subEvents[0];
  const runnerSubEvents = subEvents.slice(1);

  const batterName = getPlayerNameFromText(batterSubEvent);

  if (!batterName) {
    // Can't identify batter — process runner sub-events only
    runnerSubEvents.forEach((sub) => processRunnerSubEvent(sub, gameState));
    checkInningEnd(gameState);

    return;
  }

  // Derive lineup slot from batting order position (1-9, cycling)
  const slot = (gameState.batterIndex % 9) + 1;

  // Record PA at current out count BEFORE modifying outs
  const counts = gameState.plateAppearances.get(slot) || [0, 0, 0];
  const outIdx = Math.min(gameState.outs, 2) as 0 | 1 | 2;
  counts[outIdx] += 1;
  gameState.plateAppearances.set(slot, counts);

  // Advance batter index
  gameState.batterIndex += 1;

  // Parse and apply batter result
  const batterResult = parseBatterAction(batterSubEvent);

  switch (batterResult.result) {
    case 'out':
    case 'sac_bunt':
    case 'sac_fly':
      gameState.outs += 1;
      break;

    case 'double_play':
      gameState.outs += 1;
      break;

    case 'homer':
      clearBases(gameState.baseRunners);
      break;

    case 'triple':
      placeOnBase(gameState.baseRunners, batterName, 'third');
      break;

    case 'double':
      placeOnBase(gameState.baseRunners, batterName, batterResult.advancedTo === 'third' ? 'third' : 'second');
      break;

    case 'single':
    case 'bunt_single':
      placeOnBase(gameState.baseRunners, batterName, batterResult.advancedTo || 'first');
      break;

    case 'walk':
    case 'hbp':
    case 'fielders_choice':
    case 'error':
    case 'reached':
      placeOnBase(gameState.baseRunners, batterName, batterResult.advancedTo || 'first');
      break;

    case 'unknown':
      break;
  }

  // If the batter got a hit but was thrown out on the bases
  // (e.g. "singled, out at second c to p to 1b"), remove from bases and add an out
  if (batterResult.batterAlsoOut) {
    removeFromBases(gameState.baseRunners, batterName);
    gameState.outs += 1;
  }

  // Process runner sub-events
  runnerSubEvents.forEach((sub) => processRunnerSubEvent(sub, gameState));
  checkInningEnd(gameState);
}

function processRunnerSubEvent(subEvent: string, gameState: GameState): void {
  const result = parseRunnerSubEvent(subEvent);
  if (!result.playerName) {
    return;
  }

  if (result.isOut) {
    removeFromBases(gameState.baseRunners, result.playerName);
    gameState.outs += 1;
  } else if (result.scored) {
    removeFromBases(gameState.baseRunners, result.playerName);
  } else if (result.advancedTo) {
    placeOnBase(gameState.baseRunners, result.playerName, result.advancedTo);
  }
}

function checkInningEnd(gameState: GameState): void {
  if (gameState.outs >= 3) {
    gameState.outs = 0;
    clearBases(gameState.baseRunners);
    // batterIndex is NOT reset — persists across innings
  }
}
