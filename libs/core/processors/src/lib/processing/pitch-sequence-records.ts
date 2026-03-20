import type { BaseRunners, GameData, GamePbP, PitchSequenceRecord } from '@ws/core/models';

import { parsePitchSequence } from '../parsing/parse-pitch-sequence';
import { classifyPlay, clearBases, getPlayerNameFromText, parseBatterAction, parseRunnerSubEvent, placeOnBase, removeFromBases } from '../parsing/parse-play';

// ── Shared helpers ──

function basesSnapshot(bases: BaseRunners): { first: boolean; second: boolean; third: boolean } {
  return {
    first: bases.first !== null,
    second: bases.second !== null,
    third: bases.third !== null,
  };
}

function extractLastName(name: string): string {
  const commaIdx = name.indexOf(',');

  return (commaIdx >= 0 ? name.slice(0, commaIdx) : name).trim();
}

interface LightState {
  outs: number;
  bases: BaseRunners;
}

function freshState(): LightState {
  return { outs: 0, bases: { first: null, second: null, third: null } };
}

const NAME_PATTERN = /([A-Z](?:[a-z]*\.|[a-zA-Z]+)\s+[A-Z][a-zA-Z]+(?:-[A-Za-z]+)*(?:\s+[A-Z][a-zA-Z]+(?:-[A-Za-z]+)*)*)/;

/** Advance state for a single play (outs, base runners). Resets on 3 outs. */
function advanceState(state: LightState, playText: string): void {
  const playType = classifyPlay(playText);

  if (playType === 'no_play' || playType === 'defensive_change') {
    return;
  }

  if (playType === 'substitution') {
    const pinchRunMatch = playText.match(new RegExp(`${NAME_PATTERN.source}\\s+pinch ran for\\s+${NAME_PATTERN.source}`, 'i'));
    if (pinchRunMatch) {
      const newRunner = pinchRunMatch[1];
      const oldRunner = pinchRunMatch[2];
      if (state.bases.first === oldRunner) {
        state.bases.first = newRunner;
      }

      if (state.bases.second === oldRunner) {
        state.bases.second = newRunner;
      }

      if (state.bases.third === oldRunner) {
        state.bases.third = newRunner;
      }
    }

    return;
  }

  if (playType === 'tiebreaker') {
    const match = playText.match(new RegExp(`${NAME_PATTERN.source}\\s+placed on (?:second|2nd)`));
    if (match) {
      placeOnBase(state.bases, match[1], 'second');
    }

    return;
  }

  const subEvents = playText
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim());

  if (playType === 'stolen_base' || playType === 'wild_pitch') {
    subEvents.forEach((sub) => {
      const result = parseRunnerSubEvent(sub);
      if (!result.playerName) {
        return;
      }

      if (result.isOut) {
        removeFromBases(state.bases, result.playerName);
        state.outs += 1;
      } else if (result.scored) {
        removeFromBases(state.bases, result.playerName);
      } else if (result.advancedTo) {
        placeOnBase(state.bases, result.playerName, result.advancedTo);
      } else {
        // Stolen base sub-event
        const lower = sub.toLowerCase();
        if (lower.includes('stole home') || lower.includes('scored')) {
          removeFromBases(state.bases, result.playerName);
        } else if (lower.includes('stole third') || lower.includes('stole 3rd')) {
          removeFromBases(state.bases, result.playerName);
          placeOnBase(state.bases, result.playerName, 'third');
        } else if (lower.includes('stole second') || lower.includes('stole 2nd')) {
          removeFromBases(state.bases, result.playerName);
          placeOnBase(state.bases, result.playerName, 'second');
        }
      }
    });
    checkInningEnd(state);

    return;
  }

  // plate_appearance
  const batterSubEvent = subEvents[0];
  const runnerSubEvents = subEvents.slice(1);
  const batterName = getPlayerNameFromText(batterSubEvent);
  const action = parseBatterAction(batterSubEvent);

  switch (action.result) {
    case 'out':
    case 'sac_bunt':
    case 'sac_fly':
    case 'double_play':
      state.outs += 1;
      break;
    case 'homer':
      clearBases(state.bases);
      break;
    case 'triple':
      if (batterName) {
        placeOnBase(state.bases, batterName, 'third');
      }

      break;
    case 'double':
      if (batterName) {
        placeOnBase(state.bases, batterName, action.advancedTo === 'third' ? 'third' : 'second');
      }

      break;
    case 'single':
    case 'bunt_single':
    case 'walk':
    case 'hbp':
    case 'fielders_choice':
    case 'error':
    case 'reached':
      if (batterName) {
        placeOnBase(state.bases, batterName, action.advancedTo || 'first');
      }

      break;
  }

  if (action.batterAlsoOut && batterName) {
    removeFromBases(state.bases, batterName);
    state.outs += 1;
  }

  runnerSubEvents.forEach((sub) => {
    const result = parseRunnerSubEvent(sub);
    if (!result.playerName) {
      return;
    }

    if (result.isOut) {
      removeFromBases(state.bases, result.playerName);
      state.outs += 1;
    } else if (result.scored) {
      removeFromBases(state.bases, result.playerName);
    } else if (result.advancedTo) {
      placeOnBase(state.bases, result.playerName, result.advancedTo);
    }
  });

  checkInningEnd(state);
}

function checkInningEnd(state: LightState): void {
  if (state.outs >= 3) {
    state.outs = 0;
    clearBases(state.bases);
  }
}

// ── Shared record builder ──

function buildRecordFromPlay(playText: string, state: LightState, inningLabel: string, activePitcher: string, gameUrl: string, opponent: string, date: string): PitchSequenceRecord | null {
  const sequence = parsePitchSequence(playText);
  if (!sequence) {
    return null;
  }

  const batterSubEvent = playText
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim())[0];
  const batterName = getPlayerNameFromText(batterSubEvent);
  const action = parseBatterAction(batterSubEvent);

  return {
    gameUrl,
    opponent,
    date,
    inning: inningLabel,
    outs: state.outs,
    basesBefore: basesSnapshot(state.bases),
    pitcherName: activePitcher,
    batterName: batterName ?? 'Unknown',
    batterResult: action.result,
    sequence,
    playText,
  };
}

// ── Wellesley pitcher sequences (from pitching.json / opponent batting) ──

export function buildWellesleyPitcherSequences(games: GamePbP[]): PitchSequenceRecord[] {
  return games.flatMap((game) => {
    let activePitcher = game.pitchers[0] ?? 'Unknown';
    const reliefQueue = game.pitchers.slice(1);
    let reliefIdx = 0;
    const state = freshState();

    return game.battingInnings.flatMap((inning) =>
      inning.plays.reduce<PitchSequenceRecord[]>((acc, playText) => {
        // Check pitcher change before processing
        if (reliefIdx < reliefQueue.length) {
          const nextRelief = reliefQueue[reliefIdx];
          const lastName = extractLastName(nextRelief);
          if (lastName && playText.toLowerCase().includes(lastName.toLowerCase())) {
            activePitcher = nextRelief;
            reliefIdx++;
          }
        }

        const playType = classifyPlay(playText);
        if (playType === 'plate_appearance') {
          const record = buildRecordFromPlay(playText, state, inning.inning, activePitcher, game.url, game.opponent, game.date);
          if (record) {
            acc.push(record);
          }
        }

        advanceState(state, playText);

        return acc;
      }, [])
    );
  });
}

// ── Opponent pitcher sequences (from gamedata.json / Wellesley batting) ──

/**
 * Detect opponent pitcher from defensive change text.
 * Pattern: "FirstName LastName to p for PrevFirstName PrevLastName."
 * Returns { newPitcher, previousPitcher } or null.
 */
function parseDefensiveChangePitcher(playText: string): { newPitcher: string; previousPitcher: string } | null {
  const match = playText.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+(?:-[A-Za-z]+)*)+)\s+to\s+p\s+for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+(?:-[A-Za-z]+)*)+)/i);
  if (!match) {
    return null;
  }

  return { newPitcher: match[1], previousPitcher: match[2] };
}

interface PitcherChange {
  inning: string;
  playIdx: number;
  newPitcher: string;
  previousPitcher: string;
}

export function buildOpponentPitcherSequences(games: GameData[]): PitchSequenceRecord[] {
  return games.flatMap((game) => {
    // First pass: find all pitcher changes to identify the starter
    const pitcherChanges: PitcherChange[] = game.playByPlay.flatMap((inning) =>
      inning.plays.reduce<PitcherChange[]>((acc, play, i) => {
        const change = parseDefensiveChangePitcher(play);
        if (change) {
          acc.push({ inning: inning.inning, playIdx: i, ...change });
        }

        return acc;
      }, [])
    );

    // The first "for X" clause reveals the starter
    const starterName = pitcherChanges.length > 0 ? pitcherChanges[0].previousPitcher : 'Unknown';

    // Second pass: walk plays and build records
    let activePitcher = starterName;
    let changeIdx = 0;
    const state = freshState();

    return game.playByPlay.flatMap((inning) =>
      inning.plays.reduce<PitchSequenceRecord[]>((acc, playText, i) => {
        // Check for pitcher change
        if (changeIdx < pitcherChanges.length && pitcherChanges[changeIdx].inning === inning.inning && pitcherChanges[changeIdx].playIdx === i) {
          activePitcher = pitcherChanges[changeIdx].newPitcher;
          changeIdx++;
        }

        const playType = classifyPlay(playText);
        if (playType === 'plate_appearance') {
          const record = buildRecordFromPlay(playText, state, inning.inning, activePitcher, game.url ?? '', game.opponent ?? 'Unknown', '');
          if (record) {
            acc.push(record);
          }
        }

        advanceState(state, playText);

        return acc;
      }, [])
    );
  });
}
