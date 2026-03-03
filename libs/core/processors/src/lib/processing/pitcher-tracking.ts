import type { PitcherTrackedPlay } from '@ws/core/models';

import {
  classifyPlay,
  getPlayerNameFromText,
  parseBatterAction,
  parseRunnerSubEvent,
} from '../parsing/parse-play';

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

/**
 * Track pitcher performance across all plate appearances in a game.
 *
 * Walks through each play chronologically, maintaining the active pitcher.
 * For each plate appearance, records the batter result, runs scored,
 * and hit count. Runs scored while a pitcher is active are charged
 * to that pitcher (simple model, not inherited-runner tracking).
 *
 * Pitcher changes are detected by checking if the play text contains
 * the next expected relief pitcher's last name (from the ordered pitchers list).
 */
export function trackPitcherPerformance(
  battingInnings: BattingInning[],
  pitchers: string[]
): PitcherTrackedPlay[] {
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
        const lastName = extractLastName(nextRelief);

        if (
          lastName &&
          playText.toLowerCase().includes(lastName.toLowerCase())
        ) {
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

        if (
          ['single', 'bunt_single', 'double', 'triple', 'homer'].includes(
            action.result
          )
        ) {
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
