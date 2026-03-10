import type { BaseRunners, BaseSituation, PlaySnapshot, RunnerConversionRow, SacBuntOutcome, SacBuntSummary, ScoringPlay, ScoringPlaySummary, ScoringPlayType, StolenBaseOutcome, StolenBaseSummary } from '@ws/core/models';

import { parseBatterAction, parseRunnerSubEvent } from '../parsing/parse-play';
import { classifyBaseSituation } from './base-runner-stats';

/**
 * Pure function: given a play's before/after state, extracts all scoring plays.
 * A "scoring play" = any event where a runner crosses home plate.
 */
export function extractScoringPlays(playText: string, playType: string, basesBefore: BaseRunners, basesAfter: BaseRunners, outsBefore: number, outsAfter: number, inning: string, batterName: string | null, lineupSlot: number | null): ScoringPlay[] {
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
      (['first', 'second', 'third'] as const)
        .filter((base) => basesBefore[base])
        .forEach((base) => {
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
        });

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
    subEvents.slice(1).forEach((sub) => {
      const result = parseRunnerSubEvent(sub);

      if (result.scored && result.playerName) {
        let type = mapBatterResultToScoringType(batterAction.result, sub, subEvents[0]);

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
    });

    // Walk/HBP with bases loaded: batter forces a run even if text doesn't have "scored" for the runner
    if ((batterAction.result === 'walk' || batterAction.result === 'hbp') && basesBefore.first && basesBefore.second && basesBefore.third) {
      // Check if we already captured the forced run from third
      const alreadyCapturedThird = plays.some((p) => p.runnerName === basesBefore.third);
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
    subEvents.forEach((sub) => {
      const result = parseRunnerSubEvent(sub);
      const lower = sub.toLowerCase();

      if (result.playerName && result.isOut) {
        outRunners.add(result.playerName);
      } else if (result.playerName && (result.scored || lower.includes('stole home'))) {
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
    });

    // State-based fallback: runner was on base before but gone after (and not out or already detected)
    (['first', 'second', 'third'] as const)
      .filter((base) => basesBefore[base])
      .filter((base) => {
        const runner = basesBefore[base]!;

        return !scoredRunners.has(runner) && !outRunners.has(runner);
      })
      .forEach((base) => {
        const runner = basesBefore[base]!;
        const stillOnBase = basesAfter.first === runner || basesAfter.second === runner || basesAfter.third === runner;

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
      });

    return plays;
  }

  if (playType === 'wild_pitch') {
    subEvents.forEach((sub) => {
      const result = parseRunnerSubEvent(sub);

      if (result.scored && result.playerName) {
        const lower = playText.toLowerCase();
        const type: ScoringPlayType = lower.includes('passed ball') ? 'passed_ball' : 'wild_pitch';
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
    });

    return plays;
  }

  return plays;
}

export function mapBatterResultToScoringType(batterResult: string, runnerSubEvent: string, batterSubEvent?: string): ScoringPlayType {
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
export function computeSacBuntOutcomes(snapshots: PlaySnapshot[], opponent: string, url: string): SacBuntOutcome[] {
  const outcomes: SacBuntOutcome[] = [];

  snapshots.forEach((snap, i) => {
    if (!snap.isPlateAppearance) {
      return;
    }

    // Detect sac bunt from the batter action
    const subEvents = snap.playText
      .replace(/\.$/, '')
      .split(';')
      .map((s) => s.trim());
    const batterAction = parseBatterAction(subEvents[0]);

    if (batterAction.result !== 'sac_bunt') {
      return;
    }

    // Who was on base before the bunt?
    const runnersOnBase = (['first', 'second', 'third'] as const).filter((base) => snap.basesBefore[base]).map((base) => snap.basesBefore[base]!);

    if (runnersOnBase.length === 0) {
      return;
    }

    // Check if those runners scored in the remainder of this inning (including this play)
    const runnersScored: string[] = [];

    // Uses for...of with break — needs to stop at inning boundary
    for (const future of snapshots.slice(i)) {
      if (future.inning !== snap.inning) {
        break;
      }

      future.scoringPlays.filter((sp) => sp.runnerName && runnersOnBase.includes(sp.runnerName) && !runnersScored.includes(sp.runnerName)).forEach((sp) => runnersScored.push(sp.runnerName!));
    }

    outcomes.push({
      opponent,
      url,
      inning: snap.inning,
      batterName: snap.batterName,
      runnersOnBase,
      runnersScored,
    });
  });

  return outcomes;
}

export function mergeSacBuntOutcomes(a: SacBuntOutcome[], b: SacBuntOutcome[]): SacBuntOutcome[] {
  return [...a, ...b];
}

export function summarizeSacBuntOutcomes(outcomes: SacBuntOutcome[]): SacBuntSummary {
  const totalRunnersOnBase = outcomes.reduce((s, o) => s + o.runnersOnBase.length, 0);
  const totalRunnersScored = outcomes.reduce((s, o) => s + o.runnersScored.length, 0);

  return {
    totalSacBunts: outcomes.length,
    totalRunnersOnBase,
    totalRunnersScored,
    scoringRate: totalRunnersOnBase > 0 ? totalRunnersScored / totalRunnersOnBase : 0,
    outcomes,
  };
}

/**
 * For each stolen base in the game, tracks whether the runner eventually
 * scored in the same inning. Follows the same pattern as computeSacBuntOutcomes.
 */
export function computeStolenBaseOutcomes(snapshots: PlaySnapshot[], opponent: string, url: string): StolenBaseOutcome[] {
  const outcomes: StolenBaseOutcome[] = [];

  snapshots.forEach((snap, i) => {
    if (snap.playType !== 'stolen_base') {
      return;
    }

    const subEvents = snap.playText
      .replace(/\.$/, '')
      .split(';')
      .map((s) => s.trim());

    // Parse each sub-event for stolen base actions
    subEvents.forEach((sub) => {
      const lower = sub.toLowerCase();
      const nameMatch = sub.match(/^([A-Z]\.\s*\w+)/);

      if (!nameMatch) {
        return;
      }

      const runnerName = nameMatch[1].replace(/\s+/g, ' ');

      let stolenTo: 'second' | 'third' | 'home' | null = null;

      if (lower.includes('stole home')) {
        stolenTo = 'home';
      } else if (lower.includes('stole third')) {
        stolenTo = 'third';
      } else if (lower.includes('stole second')) {
        stolenTo = 'second';
      }

      if (!stolenTo) {
        return;
      }

      // If stole home, they scored directly
      if (stolenTo === 'home') {
        outcomes.push({
          opponent,
          url,
          inning: snap.inning,
          runnerName,
          stolenTo,
          eventuallyScored: true,
          playText: snap.playText,
        });

        return;
      }

      // Check if runner eventually scored in the remainder of this inning
      let eventuallyScored = false;

      // Uses for...of with break — needs to stop at inning boundary
      for (const future of snapshots.slice(i)) {
        if (future.inning !== snap.inning) {
          break;
        }

        if (future.scoringPlays.some((sp) => sp.runnerName === runnerName)) {
          eventuallyScored = true;
          break;
        }
      }

      outcomes.push({
        opponent,
        url,
        inning: snap.inning,
        runnerName,
        stolenTo,
        eventuallyScored,
        playText: snap.playText,
      });
    });
  });

  return outcomes;
}

export function summarizeStolenBaseOutcomes(outcomes: StolenBaseOutcome[]): StolenBaseSummary {
  const bases: ('second' | 'third' | 'home')[] = ['second', 'third', 'home'];
  const byBase = bases.map((base) => {
    const matching = outcomes.filter((o) => o.stolenTo === base);

    return {
      base,
      total: matching.length,
      scored: matching.filter((o) => o.eventuallyScored).length,
    };
  });

  const totalScored = outcomes.filter((o) => o.eventuallyScored).length;

  return {
    totalStolenBases: outcomes.length,
    byBase,
    overallScoringRate: outcomes.length > 0 ? totalScored / outcomes.length : 0,
    outcomes,
  };
}

/**
 * For each PA snapshot, counts how many runners were on base before
 * and how many of them eventually scored on that play.
 * Aggregates by base situation and out count.
 */
export function computeRunnerConversions(snapshots: PlaySnapshot[]): RunnerConversionRow[] {
  const map = new Map<
    BaseSituation,
    {
      totalRunners: number;
      runnersScored: number;
      byOuts: [number, number, number, number, number, number];
    }
  >();

  snapshots
    .filter((snap) => snap.isPlateAppearance)
    .forEach((snap) => {
      const situation = classifyBaseSituation(snap.basesBefore);

      if (situation === 'empty') {
        return;
      }

      const runners = (['first', 'second', 'third'] as const).filter((base) => snap.basesBefore[base]).map((base) => snap.basesBefore[base]!);

      const scored = runners.filter((runner) => snap.scoringPlays.some((sp) => sp.runnerName === runner));

      const entry = map.get(situation) ?? {
        totalRunners: 0,
        runnersScored: 0,
        byOuts: [0, 0, 0, 0, 0, 0], // [total0, scored0, total1, scored1, total2, scored2]
      };

      entry.totalRunners += runners.length;
      entry.runnersScored += scored.length;
      entry.byOuts[snap.outsBefore * 2] += runners.length;
      entry.byOuts[snap.outsBefore * 2 + 1] += scored.length;

      map.set(situation, entry);
    });

  const sitOrder: BaseSituation[] = ['first', 'second', 'third', 'first_second', 'first_third', 'second_third', 'loaded'];

  return sitOrder
    .filter((sit) => map.has(sit))
    .map((sit) => {
      const entry = map.get(sit)!;

      return {
        situation: sit,
        totalRunners: entry.totalRunners,
        runnersScored: entry.runnersScored,
        byOuts: [0, 1, 2].map((outs) => ({
          outs,
          totalRunners: entry.byOuts[outs * 2],
          runnersScored: entry.byOuts[outs * 2 + 1],
        })),
      };
    });
}

/**
 * Aggregates an array of ScoringPlays into a summary.
 */
export function computeScoringPlaySummary(plays: ScoringPlay[]): ScoringPlaySummary {
  const byType: Record<string, number> = {};
  const byRunner: Record<string, number> = {};
  const byBatter: Record<string, number> = {};

  plays.forEach((play) => {
    byType[play.scoringPlayType] = (byType[play.scoringPlayType] || 0) + 1;

    if (play.runnerName) {
      byRunner[play.runnerName] = (byRunner[play.runnerName] || 0) + 1;
    }

    if (play.batterName) {
      byBatter[play.batterName] = (byBatter[play.batterName] || 0) + 1;
    }
  });

  return {
    totalRuns: plays.length,
    byType,
    byRunner,
    byBatter,
  };
}
