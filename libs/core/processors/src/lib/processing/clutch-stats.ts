import type { BatterResult, ClutchEvent, ClutchSummary, GameWithSnapshots, PbpBattingAccum, PlayerClutchGame, PlayerClutchSummary, PlaySnapshot, RunnerOutcome } from '@ws/core/models';

import { parseBatterAction } from '../parsing/parse-play';
import { calculateWoba } from '../woba/woba';
import { classifyBaseSituation } from './base-runner-stats';

const RISP_SITUATIONS = new Set(['second', 'third', 'first_second', 'first_third', 'second_third', 'loaded']);

/** Canonical grouping key for a play-text batter name ("G. DiBacco" and "G. Dibacco" collide). */
function canonicalBatterKey(name: string): string {
  return name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

const SAFE_BATTER_RESULTS = new Set(['single', 'bunt_single', 'double', 'triple', 'homer', 'walk', 'hbp', 'fielders_choice', 'error', 'reached']);

/**
 * A PA is "productive" when the team's situation didn't get worse:
 * batter reached safely, OR batter was out but a runner advanced/scored
 * (sac fly, sac bunt, productive grounder), AND no runner was retired.
 */
export function isProductive(event: ClutchEvent): boolean {
  if (event.batterResult === 'double_play') {
    return false;
  }

  const anyRunnerOut = event.runnersOn.some((r) => r.outcome === 'out');

  if (anyRunnerOut) {
    return false;
  }

  if (SAFE_BATTER_RESULTS.has(event.batterResult)) {
    return true;
  }

  if (event.batterResult === 'sac_fly' || event.batterResult === 'sac_bunt') {
    return true;
  }

  return event.runnersScored > 0 || event.runnersAdvanced > 0;
}

export function emptyAccum(): PbpBattingAccum {
  return { pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sh: 0 };
}

export function accumFromResult(result: BatterResult, accum: PbpBattingAccum): void {
  accum.pa++;

  switch (result) {
    case 'single':
    case 'bunt_single':
      accum.ab++;
      accum.h++;
      break;
    case 'double':
      accum.ab++;
      accum.h++;
      accum.doubles++;
      break;
    case 'triple':
      accum.ab++;
      accum.h++;
      accum.triples++;
      break;
    case 'homer':
      accum.ab++;
      accum.h++;
      accum.hr++;
      break;
    case 'fielders_choice':
    case 'error':
      accum.ab++;
      break;
    case 'walk':
      accum.bb++;
      break;
    case 'hbp':
      accum.hbp++;
      break;
    case 'sac_bunt':
      accum.sh++;
      break;
    case 'sac_fly':
      accum.sf++;
      break;
    case 'out':
    case 'double_play':
    case 'reached':
      accum.ab++;
      break;
    case 'unknown':
      break;
  }
}

/**
 * For a single game's snapshots, extracts all PAs with runners on base
 * and classifies what happened to each runner.
 */
export function computeClutchEvents(snapshots: PlaySnapshot[], opponent: string, url: string): ClutchEvent[] {
  const events: ClutchEvent[] = [];

  snapshots.forEach((snap, i) => {
    if (!snap.isPlateAppearance || snap.batterName === null || snap.lineupSlot === null) {
      return;
    }

    const situation = classifyBaseSituation(snap.basesBefore);

    const subEvents = snap.playText
      .replace(/\.$/, '')
      .split(';')
      .map((s) => s.trim());

    const batterAction = parseBatterAction(subEvents[0]);

    // Pinch-hit detection: scan backwards for a substitution with "pinch hit"
    let isPinchHit = false;

    // Use for...of with break to scan backwards
    for (let j = i - 1; j >= 0; j--) {
      const prev = snapshots[j];

      if (prev.inning !== snap.inning) {
        break;
      }

      if (prev.isPlateAppearance) {
        break;
      }

      if (prev.playType === 'substitution' && prev.playText.toLowerCase().includes('pinch hit')) {
        isPinchHit = true;
        break;
      }
    }

    // Build runner outcomes
    const bases: ('first' | 'second' | 'third')[] = ['first', 'second', 'third'];
    const inningEnded = snap.outsAfter === 0 && snap.outsBefore > 0;
    const runnersOn: RunnerOutcome[] = bases
      .filter((base) => snap.basesBefore[base])
      .map((base) => {
        const name = snap.basesBefore[base]!;
        const scored = snap.scoringPlays.some((sp) => sp.runnerName === name);

        if (scored) {
          return { name, baseBefore: base, outcome: 'scored' as const };
        }

        // Check if runner is on a higher base after the play
        const baseOrder = { first: 1, second: 2, third: 3 };
        const beforeIdx = baseOrder[base];
        const afterBases = bases.filter((b) => snap.basesAfter[b] === name);

        if (afterBases.length > 0) {
          const afterIdx = Math.max(...afterBases.map((b) => baseOrder[b]));

          if (afterIdx > beforeIdx) {
            return { name, baseBefore: base, outcome: 'advanced' as const };
          }

          return { name, baseBefore: base, outcome: 'stranded' as const };
        }

        // Runner disappeared from bases without scoring.
        // If the inning just ended (outs reset to 0), the runner was
        // left on base — stranded, not put out on the play.
        if (inningEnded) {
          return { name, baseBefore: base, outcome: 'stranded' as const };
        }

        return { name, baseBefore: base, outcome: 'out' as const };
      });

    const runnersScored = runnersOn.filter((r) => r.outcome === 'scored').length;
    const runnersAdvanced = runnersOn.filter((r) => r.outcome === 'advanced').length;
    const runnersStranded = runnersOn.filter((r) => r.outcome === 'stranded').length;

    events.push({
      opponent,
      url,
      inning: snap.inning,
      outsBefore: snap.outsBefore,
      baseSituation: situation,
      batterName: snap.batterName,
      lineupSlot: snap.lineupSlot,
      batterResult: batterAction.result,
      isPinchHit,
      playText: snap.playText,
      runnersOn,
      runnersScored,
      runnersAdvanced,
      runnersStranded,
    });
  });

  return events;
}

/**
 * Aggregates clutch events across all games into per-player summaries
 * with wOBA splits for runners-on, bases-empty, RISP, and overall.
 */
export function computeClutchSummary(games: GameWithSnapshots[]): ClutchSummary {
  // Collect all clutch events
  const allEvents = games.flatMap((game) => computeClutchEvents(game.snapshots, game.opponent, game.url));

  // Build per-player stat accumulators (keyed by canonical name) from ALL PA snapshots.
  // Display names track the longest spelling seen so truncated variants collapse into full names.
  const playerAccums = new Map<
    string,
    {
      displayName: string;
      runnersOn: PbpBattingAccum;
      basesEmpty: PbpBattingAccum;
      risp: PbpBattingAccum;
      overall: PbpBattingAccum;
    }
  >();

  const allSnapshots = games.flatMap((game) => game.snapshots);

  allSnapshots
    .filter((snap) => snap.isPlateAppearance && snap.batterName !== null)
    .forEach((snap) => {
      const name = snap.batterName!;
      const key = canonicalBatterKey(name);
      const situation = classifyBaseSituation(snap.basesBefore);
      const subEvents = snap.playText
        .replace(/\.$/, '')
        .split(';')
        .map((s) => s.trim());
      const result = parseBatterAction(subEvents[0]).result;

      if (!playerAccums.has(key)) {
        playerAccums.set(key, {
          displayName: name,
          runnersOn: emptyAccum(),
          basesEmpty: emptyAccum(),
          risp: emptyAccum(),
          overall: emptyAccum(),
        });
      }

      const accums = playerAccums.get(key)!;

      if (name.length > accums.displayName.length) {
        accums.displayName = name;
      }

      // Overall
      accumFromResult(result, accums.overall);

      // Split buckets
      if (situation === 'empty') {
        accumFromResult(result, accums.basesEmpty);
      } else {
        accumFromResult(result, accums.runnersOn);

        if (RISP_SITUATIONS.has(situation)) {
          accumFromResult(result, accums.risp);
        }
      }
    });

  // Group clutch events by canonical player key
  const eventsByPlayer = new Map<string, ClutchEvent[]>();
  allEvents.forEach((event) => {
    const key = canonicalBatterKey(event.batterName);
    const existing = eventsByPlayer.get(key) ?? [];
    existing.push(event);
    eventsByPlayer.set(key, existing);
  });

  // Build player summaries
  const players: PlayerClutchSummary[] = Array.from(eventsByPlayer.entries()).map(([key, allPlayerEvents]) => {
    const accums = playerAccums.get(key) ?? {
      displayName: allPlayerEvents[0]?.batterName ?? key,
      runnersOn: emptyAccum(),
      basesEmpty: emptyAccum(),
      risp: emptyAccum(),
      overall: emptyAccum(),
    };

    const events = allPlayerEvents.filter((e) => e.baseSituation !== 'empty');
    const emptyEvents = allPlayerEvents.filter((e) => e.baseSituation === 'empty');

    const runnersOnWoba = calculateWoba(accums.runnersOn);
    const basesEmptyWoba = calculateWoba(accums.basesEmpty);
    const rispWoba = calculateWoba(accums.risp);
    const overallWoba = calculateWoba(accums.overall);

    const totalRunnersOn = events.reduce((sum, e) => sum + e.runnersOn.length, 0);
    const runnersDrivenIn = events.reduce((sum, e) => sum + e.runnersScored, 0);
    const runnersAdvanced = events.reduce((sum, e) => sum + e.runnersAdvanced, 0);
    const runnersStranded = events.reduce((sum, e) => sum + e.runnersStranded, 0);

    const eligibleEmpty = emptyEvents.filter((e) => e.batterResult !== 'error' && e.batterResult !== 'hbp');
    const eligibleAll = allPlayerEvents.filter((e) => e.batterResult !== 'error' && e.batterResult !== 'hbp');
    const basesEmptyProductive = eligibleEmpty.filter(isProductive).length;
    const overallProductive = eligibleAll.filter(isProductive).length;

    // By outs breakdown
    const byOuts = [0, 1, 2].map((outs) => {
      const outsEvents = events.filter((e) => e.outsBefore === outs);

      return {
        outs,
        pa: outsEvents.length,
        drivenIn: outsEvents.reduce((sum, e) => sum + e.runnersScored, 0),
        lob: outsEvents.reduce((sum, e) => sum + e.runnersStranded, 0),
      };
    });

    // Group by game
    const gameMap = new Map<string, { opponent: string; url: string; events: ClutchEvent[] }>();
    events.forEach((event) => {
      const key = event.url;
      const existing = gameMap.get(key) ?? { opponent: event.opponent, url: event.url, events: [] };
      existing.events.push(event);
      gameMap.set(key, existing);
    });

    const gameEntries: PlayerClutchGame[] = Array.from(gameMap.values()).map((g) => ({
      opponent: g.opponent,
      url: g.url,
      runnersOnPa: g.events.length,
      drivenIn: g.events.reduce((sum, e) => sum + e.runnersScored, 0),
      stranded: g.events.reduce((sum, e) => sum + e.runnersStranded, 0),
      events: g.events,
    }));

    return {
      name: accums.displayName,
      runnersOnWoba,
      basesEmptyWoba,
      rispWoba,
      overallWoba,
      wobaDelta: runnersOnWoba - basesEmptyWoba,
      runnersOnPa: events.length,
      totalRunnersOn,
      runnersDrivenIn,
      runnersAdvanced,
      runnersStranded,
      byOuts,
      games: gameEntries,
      events,
      runnersOnStats: accums.runnersOn,
      basesEmptyStats: accums.basesEmpty,
      rispStats: accums.risp,
      overallStats: accums.overall,
      basesEmptyProductive,
      basesEmptyTotal: eligibleEmpty.length,
      overallProductive,
      overallProductiveTotal: eligibleAll.length,
    };
  });

  // Sort by ROB wOBA descending
  players.sort((a, b) => b.runnersOnWoba - a.runnersOnWoba);

  return { players, allEvents };
}

/**
 * Rebuilds a PlayerClutchSummary from a filtered subset of events.
 * Used by the UI to recompute wOBA splits when filters change.
 */
export function rebuildPlayerFromEvents(name: string, events: ClutchEvent[], originalPlayer: PlayerClutchSummary): PlayerClutchSummary {
  const runnersOnStats = emptyAccum();
  events.forEach((e) => accumFromResult(e.batterResult, runnersOnStats));

  const runnersOnWoba = calculateWoba(runnersOnStats);
  const totalRunnersOn = events.reduce((sum, e) => sum + e.runnersOn.length, 0);
  const runnersDrivenIn = events.reduce((sum, e) => sum + e.runnersScored, 0);
  const runnersAdvanced = events.reduce((sum, e) => sum + e.runnersAdvanced, 0);
  const runnersStranded = events.reduce((sum, e) => sum + e.runnersStranded, 0);

  const byOuts = [0, 1, 2].map((outs) => {
    const outsEvents = events.filter((e) => e.outsBefore === outs);

    return {
      outs,
      pa: outsEvents.length,
      drivenIn: outsEvents.reduce((sum, e) => sum + e.runnersScored, 0),
      lob: outsEvents.reduce((sum, e) => sum + e.runnersStranded, 0),
    };
  });

  const gameMap = new Map<string, { opponent: string; url: string; events: ClutchEvent[] }>();
  events.forEach((e) => {
    const existing = gameMap.get(e.url) ?? { opponent: e.opponent, url: e.url, events: [] };
    existing.events.push(e);
    gameMap.set(e.url, existing);
  });

  const games: PlayerClutchGame[] = Array.from(gameMap.values()).map((g) => ({
    opponent: g.opponent,
    url: g.url,
    runnersOnPa: g.events.length,
    drivenIn: g.events.reduce((sum, e) => sum + e.runnersScored, 0),
    stranded: g.events.reduce((sum, e) => sum + e.runnersStranded, 0),
    events: g.events,
  }));

  const rispStats = emptyAccum();
  events.filter((e) => RISP_SITUATIONS.has(e.baseSituation)).forEach((e) => accumFromResult(e.batterResult, rispStats));

  return {
    name,
    runnersOnWoba,
    basesEmptyWoba: originalPlayer.basesEmptyWoba,
    rispWoba: calculateWoba(rispStats),
    overallWoba: originalPlayer.overallWoba,
    wobaDelta: runnersOnWoba - originalPlayer.basesEmptyWoba,
    runnersOnPa: events.length,
    totalRunnersOn,
    runnersDrivenIn,
    runnersAdvanced,
    runnersStranded,
    byOuts,
    games,
    events,
    runnersOnStats,
    basesEmptyStats: originalPlayer.basesEmptyStats,
    rispStats,
    overallStats: originalPlayer.overallStats,
    basesEmptyProductive: originalPlayer.basesEmptyProductive,
    basesEmptyTotal: originalPlayer.basesEmptyTotal,
    overallProductive: originalPlayer.overallProductive,
    overallProductiveTotal: originalPlayer.overallProductiveTotal,
  };
}
