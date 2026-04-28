import type { PitchCode, PitchCountInningStats, PitchSequenceRecord } from '@ws/core/models';

import { inningToNumber } from './pitcher-stats';

const STRIKE_CODES: Set<PitchCode> = new Set(['K', 'S', 'F']);

// Marker for an implicit ball-in-play that ended the AB but isn't recorded in the pitch sequence.
type EffectivePitch = PitchCode | 'BIP';

function isStrikeForCount(p: EffectivePitch): boolean {
  // Per scoring convention: only balls (B) and HBP (H) are NOT strikes for pitch-count %s.
  // K, S, F (recorded strikes) and BIP (ball put in play) all count as strikes.
  return p !== 'B' && p !== 'H';
}

function effectivePitches(pitches: PitchCode[]): EffectivePitch[] {
  const total = computePitchCount(pitches);

  if (total > pitches.length) {
    return [...pitches, 'BIP'];
  }

  return [...pitches];
}

function emptyStats(inning: string): PitchCountInningStats {
  return {
    inning,
    pasWithSequence: 0,
    totalPitches: 0,
    balls: 0,
    strikes: 0,
    sequences: [],
    firstPitchCount: 0,
    firstPitchStrikes: 0,
    firstPitchSwingMiss: 0,
    firstTwoPitchesCount: 0,
    firstTwoPitchesStrike: 0,
    firstTwoPitchesSwingMiss: 0,
  };
}

const NUMERIC_KEYS: (keyof PitchCountInningStats)[] = ['pasWithSequence', 'totalPitches', 'balls', 'strikes', 'firstPitchCount', 'firstPitchStrikes', 'firstPitchSwingMiss', 'firstTwoPitchesCount', 'firstTwoPitchesStrike', 'firstTwoPitchesSwingMiss'];

function mergeInto(target: PitchCountInningStats, source: PitchCountInningStats): void {
  NUMERIC_KEYS.forEach((k) => {
    (target[k] as number) += source[k] as number;
  });
  target.sequences.push(...source.sequences);
}

export function computePitchCount(pitches: PitchCode[]): number {
  const count = pitches.length;

  if (count === 0) {
    return 1;
  }

  const last = count - 1;
  // can't end an at bat on a foul, when fouling out, not recorded, so return count + 1
  if (pitches?.[last] === 'F') {
    return count + 1;
  }

  // at bat ended without ball put in play, so count is the whole at bat
  if (pitches?.[last] === 'H' || pitches.filter((p) => p === 'B').length === 4) {
    return count;
  }

  // last pitch was a strike, did it end the at bat?
  if (['S', 'K'].includes(pitches?.[last])) {
    // strike out
    const swingsAndKs = pitches.filter((p) => p === 'S' || p === 'K').length;
    if (swingsAndKs === 3) {
      return count;
    }

    // If last pitch is only strike, need to see if they also had 2 or more fouls against them
    if (swingsAndKs === 1) {
      return pitches.filter((p) => p === 'F').length >= 2 ? count : count + 1;
    }

    // if two k/s, if there is also a foul in there, that's 3 strikes, so strikeout. if not, no other
    // way to get a strike, so you only had 2, so ball must have been put in play
    if (swingsAndKs === 2) {
      return pitches.includes('F') ? count : count + 1;
    }
  }

  return count + 1;
}

export function computePitchCountByInning(records: PitchSequenceRecord[], pitcher: string): { byInning: Map<string, PitchCountInningStats>; totals: PitchCountInningStats } {
  const byInning = new Map<string, PitchCountInningStats>();

  records
    .filter((r) => r.pitcherName === pitcher)
    .forEach((r) => {
      const pitches = r.sequence.pitches?.length ? r.sequence.pitches : [];

      if (!byInning.has(r.inning)) {
        byInning.set(r.inning, emptyStats(r.inning));
      }

      const stats = byInning.get(r.inning)!;
      const seqStr = pitches?.join('');

      const effective = effectivePitches(pitches);

      stats.pasWithSequence += 1;
      stats.totalPitches += computePitchCount(pitches);
      stats.balls += pitches.filter((p) => p === 'B').length;
      stats.strikes += effective.filter(isStrikeForCount).length;
      stats.sequences.push(seqStr);

      if (effective.length >= 1) {
        stats.firstPitchCount += 1;

        if (isStrikeForCount(effective[0])) {
          stats.firstPitchStrikes += 1;
        }

        if (effective[0] === 'S') {
          stats.firstPitchSwingMiss += 1;
        }
      }

      if (effective.length >= 1) {
        const firstTwo = effective.slice(0, 2);
        stats.firstTwoPitchesCount += 1;

        if (firstTwo.some(isStrikeForCount)) {
          stats.firstTwoPitchesStrike += 1;
        }

        if (firstTwo.some((p) => p === 'S')) {
          stats.firstTwoPitchesSwingMiss += 1;
        }
      }
    });

  // Sort by inning number
  const sorted = new Map(Array.from(byInning.entries()).sort(([a], [b]) => inningToNumber(a) - inningToNumber(b)));

  const totals = emptyStats('Total');

  sorted.forEach((stats) => {
    mergeInto(totals, stats);
  });

  return { byInning: sorted, totals };
}
