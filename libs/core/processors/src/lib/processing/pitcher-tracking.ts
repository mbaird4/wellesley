import type { PitcherTrackedPlay } from '@ws/core/models';

import { classifyPlay, getPlayerNameFromText, parseBatterAction, parseRunnerSubEvent } from '../parsing/parse-play';

interface BattingInning {
  inning: string;
  plays: string[];
}

/**
 * Extract last name from "Last, First" format (as returned by pitching table).
 * Falls back to the full string if no comma is present.
 */
function extractLastName(name: string): string {
  const commaIdx = name.indexOf(',');

  return (commaIdx >= 0 ? name.slice(0, commaIdx) : name).trim();
}

/** Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const initial = Array.from({ length: b.length + 1 }, (_, j) => j);

  const final = Array.from(a).reduce((prev, charA) => {
    return Array.from(b).reduce(
      (curr, charB, j) => {
        curr[j + 1] = charA === charB ? prev[j] : 1 + Math.min(prev[j + 1], curr[j], prev[j]);

        return curr;
      },
      [prev[0] + 1] as number[]
    );
  }, initial);

  return final[b.length];
}

/**
 * Fuzzy-match a last name against words in a play text.
 * Exact substring match is the fast path. Falls back to edit-distance
 * comparison against each word: ≤1 for short names (≤4 chars), ≤2 for longer.
 */
function fuzzyLastNameMatch(playText: string, lastName: string): boolean {
  const lower = playText.toLowerCase();
  const target = lastName.toLowerCase();

  if (lower.includes(target)) {
    return true;
  }

  const words = lower.replace(/[.,;]/g, '').split(/\s+/);
  const maxDist = target.length <= 4 ? 1 : 2;

  return words.some((word) => editDistance(word, target) <= maxDist);
}

/**
 * Track pitcher performance across all plate appearances in a game.
 *
 * Walks through each play chronologically, maintaining the active pitcher.
 * For each plate appearance, records the batter result, runs scored,
 * and hit count. Runs scored while a pitcher is active are charged
 * to that pitcher (simple model, not inherited-runner tracking).
 *
 * Pitcher changes are detected via fuzzy matching of the next expected
 * relief pitcher's last name against the play text. An optional aliases
 * map overrides the extracted last name for pitchers whose name in the
 * pitching table doesn't match the play-by-play text.
 */
export function trackPitcherPerformance(battingInnings: BattingInning[], pitchers: string[], aliases?: Record<string, string>): PitcherTrackedPlay[] {
  const tracked: PitcherTrackedPlay[] = [];
  let activePitcher = pitchers[0] ?? 'Unknown';

  // Build a queue of relief pitchers (in appearance order)
  const reliefQueue = pitchers.slice(1);
  let reliefIdx = 0;

  battingInnings.forEach((inning) => {
    inning.plays.forEach((playText) => {
      // Check if the next relief pitcher's last name appears in this play
      if (reliefIdx < reliefQueue.length) {
        const nextRelief = reliefQueue[reliefIdx];
        const lastName = aliases?.[nextRelief] ?? extractLastName(nextRelief);

        if (lastName && fuzzyLastNameMatch(playText, lastName)) {
          activePitcher = nextRelief;
          reliefIdx++;
        }
      }

      const playType = classifyPlay(playText);

      // Only track plate appearances and certain scoring events
      const isPA = playType === 'plate_appearance';
      if (!isPA && playType !== 'wild_pitch' && playType !== 'stolen_base') {
        return;
      }

      const subEvents = playText
        .replace(/\.$/, '')
        .split(';')
        .map((s) => s.trim());

      const batterSubEvent = subEvents[0];
      const runnerSubEvents = subEvents.slice(1);

      // Determine batter result
      let batterResult = 'none';
      let hitsOnPlay = 0;
      const batterName = getPlayerNameFromText(batterSubEvent);

      if (isPA) {
        const action = parseBatterAction(batterSubEvent);
        batterResult = action.result;

        if (['single', 'bunt_single', 'double', 'triple', 'homer'].includes(action.result)) {
          hitsOnPlay = 1;
        }
      }

      // Count runs scored from all sub-events
      let runsScored = 0;

      if (isPA) {
        const action = parseBatterAction(batterSubEvent);
        if (action.result === 'homer') {
          runsScored += 1; // batter scores on homer
        }
      }

      runnerSubEvents.forEach((sub) => {
        const result = parseRunnerSubEvent(sub);
        if (result.scored) {
          runsScored += 1;
        }
      });

      tracked.push({
        activePitcher,
        inning: inning.inning,
        batterName: isPA ? batterName : null,
        batterResult,
        playText,
        runsScored,
        hitsOnPlay,
        isPlateAppearance: isPA,
      });
    });
  });

  return tracked;
}
