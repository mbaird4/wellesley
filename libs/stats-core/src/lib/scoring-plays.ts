import { classifyBaseSituation } from './base-runner-stats';
import {
  classifyPlay,
  getPlayerNameFromText,
  parseBatterAction,
  parseRunnerSubEvent,
} from './parse-play';
import type {
  BaseRunners,
  PlaySnapshot,
  SacBuntOutcome,
  SacBuntSummary,
  ScoringPlay,
  ScoringPlaySummary,
  ScoringPlayType,
} from './types';

/**
 * Pure function: given a play's before/after state, extracts all scoring plays.
 * A "scoring play" = any event where a runner crosses home plate.
 */
export function extractScoringPlays(
  playText: string,
  playType: string,
  basesBefore: BaseRunners,
  basesAfter: BaseRunners,
  outsBefore: number,
  outsAfter: number,
  inning: string,
  batterName: string | null,
  lineupSlot: number | null
): ScoringPlay[] {
  const plays: ScoringPlay[] = [];
  const baseSituation = classifyBaseSituation(basesBefore);

  // Count runners who were on base before but are gone after (and not still on a base)
  // We detect scoring by parsing the play text for "scored" mentions
  const subEvents = playText
    .replace(/\.$/, '')
    .split(';')
    .map((s) => s.trim());

  if (playType === 'plate_appearance') {
    const batterAction = parseBatterAction(subEvents[0]);

    // Homer: batter + all runners on base score
    if (batterAction.result === 'homer') {
      // Runners on base score
      for (const base of ['first', 'second', 'third'] as const) {
        if (basesBefore[base]) {
          plays.push({
            runnerName: basesBefore[base],
            scoringPlayType: 'homer',
            batterName,
            lineupSlot,
            inning,
            outs: outsBefore,
            baseSituation,
            playText,
          });
        }
      }

      // Batter scores
      plays.push({
        runnerName: batterName,
        scoringPlayType: 'homer',
        batterName,
        lineupSlot,
        inning,
        outs: outsBefore,
        playText,
        baseSituation,
      });

      return plays;
    }

    // For non-homer PAs, check runner sub-events for "scored"
    const runnerSubEvents = subEvents.slice(1);
    for (const sub of runnerSubEvents) {
      const result = parseRunnerSubEvent(sub);
      if (result.scored && result.playerName) {
        let type = mapBatterResultToScoringType(
          batterAction.result,
          sub,
          subEvents[0]
        );
        // Runner sub-event explicitly mentions error → override to 'error'
        if (sub.toLowerCase().includes('error')) {
          type = 'error';
        }

        plays.push({
          runnerName: result.playerName,
          scoringPlayType: type,
          batterName,
          lineupSlot,
          inning,
          outs: outsBefore,
          baseSituation,
          playText,
        });
      }
    }

    // Walk/HBP with bases loaded: batter forces a run even if text doesn't have "scored" for the runner
    if (
      (batterAction.result === 'walk' || batterAction.result === 'hbp') &&
      basesBefore.first &&
      basesBefore.second &&
      basesBefore.third
    ) {
      // Check if we already captured the forced run from third
      const alreadyCapturedThird = plays.some(
        (p) => p.runnerName === basesBefore.third
      );
      if (!alreadyCapturedThird) {
        plays.push({
          runnerName: basesBefore.third,
          scoringPlayType: batterAction.result === 'walk' ? 'walk' : 'hbp',
          batterName,
          lineupSlot,
          inning,
          outs: outsBefore,
          baseSituation,
          playText,
        });
      }
    }

    return plays;
  }

  // Non-PA events: stolen bases, wild pitches, passed balls
  if (playType === 'stolen_base') {
    const scoredRunners = new Set<string>();
    const outRunners = new Set<string>();

    // Text-based detection
    for (const sub of subEvents) {
      const result = parseRunnerSubEvent(sub);
      const lower = sub.toLowerCase();

      if (result.playerName && result.isOut) {
        outRunners.add(result.playerName);
      } else if (
        result.playerName &&
        (result.scored || lower.includes('stole home'))
      ) {
        scoredRunners.add(result.playerName);
        plays.push({
          runnerName: result.playerName,
          scoringPlayType: lower.includes('error') ? 'error' : 'stolen_base',
          batterName: null,
          lineupSlot: null,
          inning,
          outs: outsBefore,
          baseSituation,
          playText,
        });
      }
    }

    // State-based fallback: runner was on base before but gone after (and not out or already detected)
    for (const base of ['first', 'second', 'third'] as const) {
      const runner = basesBefore[base];
      if (!runner) {
        continue;
      }

      if (scoredRunners.has(runner) || outRunners.has(runner)) {
        continue;
      }

      const stillOnBase =
        basesAfter.first === runner ||
        basesAfter.second === runner ||
        basesAfter.third === runner;
      if (!stillOnBase) {
        plays.push({
          runnerName: runner,
          scoringPlayType: 'stolen_base',
          batterName: null,
          lineupSlot: null,
          inning,
          outs: outsBefore,
          baseSituation,
          playText,
        });
      }
    }

    return plays;
  }

  if (playType === 'wild_pitch') {
    for (const sub of subEvents) {
      const result = parseRunnerSubEvent(sub);
      if (result.scored && result.playerName) {
        const lower = playText.toLowerCase();
        const type: ScoringPlayType = lower.includes('passed ball')
          ? 'passed_ball'
          : 'wild_pitch';
        plays.push({
          runnerName: result.playerName,
          scoringPlayType: type,
          batterName: null,
          lineupSlot: null,
          inning,
          outs: outsBefore,
          baseSituation,
          playText,
        });
      }
    }

    return plays;
  }

  return plays;
}

export function mapBatterResultToScoringType(
  batterResult: string,
  runnerSubEvent: string,
  batterSubEvent?: string
): ScoringPlayType {
  switch (batterResult) {
    case 'triple':
      return 'triple';
    case 'double':
      return 'double';
    case 'single':
      return 'single';
    case 'bunt_single':
      return 'bunt_single';
    case 'walk':
      return 'walk';
    case 'hbp':
      return 'hbp';
    case 'sac_fly':
      return 'sac_fly';
    case 'sac_bunt':
      return 'sac_bunt';
    case 'reached': {
      // Error info is often in the batter sub-event ("reached first on an error by ss")
      // rather than the runner sub-event ("scored, unearned")
      const runnerLower = runnerSubEvent.toLowerCase();
      const batterLower = (batterSubEvent || '').toLowerCase();
      if (runnerLower.includes('error') || batterLower.includes('error')) {
        return 'error';
      }

      return 'fielders_choice';
    }

    case 'out':
    case 'double_play':
      return 'productive_out';
    default:
      return 'unknown';
  }
}

/**
 * For each sac bunt in the game, tracks whether the runners already on base
 * eventually scored in the same inning.
 */
export function computeSacBuntOutcomes(
  snapshots: PlaySnapshot[],
  opponent: string,
  url: string
): SacBuntOutcome[] {
  const outcomes: SacBuntOutcome[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];
    if (!snap.isPlateAppearance) {
      continue;
    }

    // Detect sac bunt from the batter action
    const subEvents = snap.playText
      .replace(/\.$/, '')
      .split(';')
      .map((s) => s.trim());
    const batterAction = parseBatterAction(subEvents[0]);
    if (batterAction.result !== 'sac_bunt') {
      continue;
    }

    // Who was on base before the bunt?
    const runnersOnBase: string[] = [];
    for (const base of ['first', 'second', 'third'] as const) {
      if (snap.basesBefore[base]) {
        runnersOnBase.push(snap.basesBefore[base]!);
      }
    }

    if (runnersOnBase.length === 0) {
      continue;
    }

    // Check if those runners scored in the remainder of this inning (including this play)
    const runnersScored: string[] = [];
    for (let j = i; j < snapshots.length; j++) {
      if (snapshots[j].inning !== snap.inning) {
        break;
      }

      for (const sp of snapshots[j].scoringPlays) {
        if (
          sp.runnerName &&
          runnersOnBase.includes(sp.runnerName) &&
          !runnersScored.includes(sp.runnerName)
        ) {
          runnersScored.push(sp.runnerName);
        }
      }
    }

    outcomes.push({
      opponent,
      url,
      inning: snap.inning,
      batterName: snap.batterName,
      runnersOnBase,
      runnersScored,
    });
  }

  return outcomes;
}

export function mergeSacBuntOutcomes(
  a: SacBuntOutcome[],
  b: SacBuntOutcome[]
): SacBuntOutcome[] {
  return [...a, ...b];
}

export function summarizeSacBuntOutcomes(
  outcomes: SacBuntOutcome[]
): SacBuntSummary {
  const totalRunnersOnBase = outcomes.reduce(
    (s, o) => s + o.runnersOnBase.length,
    0
  );
  const totalRunnersScored = outcomes.reduce(
    (s, o) => s + o.runnersScored.length,
    0
  );

  return {
    totalSacBunts: outcomes.length,
    totalRunnersOnBase,
    totalRunnersScored,
    scoringRate:
      totalRunnersOnBase > 0 ? totalRunnersScored / totalRunnersOnBase : 0,
    outcomes,
  };
}

/**
 * Aggregates an array of ScoringPlays into a summary.
 */
export function computeScoringPlaySummary(
  plays: ScoringPlay[]
): ScoringPlaySummary {
  const byType: Record<string, number> = {};
  const byRunner: Record<string, number> = {};
  const byBatter: Record<string, number> = {};

  for (const play of plays) {
    byType[play.scoringPlayType] = (byType[play.scoringPlayType] || 0) + 1;

    if (play.runnerName) {
      byRunner[play.runnerName] = (byRunner[play.runnerName] || 0) + 1;
    }

    if (play.batterName) {
      byBatter[play.batterName] = (byBatter[play.batterName] || 0) + 1;
    }
  }

  return {
    totalRuns: plays.length,
    byType,
    byRunner,
    byBatter,
  };
}
