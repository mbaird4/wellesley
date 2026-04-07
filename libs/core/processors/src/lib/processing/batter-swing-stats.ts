import type { BatterSwingStats, PitchSequence, PitchSequenceRecord, SwingQueryConfig } from '@ws/core/models';

import { computePitchCount } from './pitch-count-stats';

/**
 * Determine whether the batter swung at a specific pitch in the sequence.
 * Returns `true` (swung), `false` (took), or `null` (pitch never occurred).
 */
export function didSwingAtPitch(sequence: PitchSequence, pitchIndex: number): boolean | null {
  const actualPitchCount = computePitchCount(sequence.pitches);

  if (pitchIndex >= actualPitchCount) {
    return null;
  }

  if (pitchIndex < sequence.pitches.length) {
    const code = sequence.pitches[pitchIndex];

    return code === 'S' || code === 'F';
  }

  // pitchIndex === pitches.length and pitchIndex < actualPitchCount
  // → inferred contact pitch (ball put in play)
  return true;
}

export function computeBatterSwingStats(records: PitchSequenceRecord[], config: SwingQueryConfig = { pitchIndices: [0], mode: 'any' }): BatterSwingStats[] {
  const byBatter = new Map<string, { total: number; swings: number }>();

  records.forEach((record) => {
    const results = config.pitchIndices.map((idx) => didSwingAtPitch(record.sequence, idx));

    // If any queried pitch didn't occur, exclude this PA
    if (results.some((r) => r === null)) {
      return;
    }

    const name = record.batterName;
    let entry = byBatter.get(name);

    if (!entry) {
      entry = { total: 0, swings: 0 };
      byBatter.set(name, entry);
    }

    entry.total += 1;

    const swung = config.mode === 'any' ? results.some((r) => r === true) : results.every((r) => r === true);

    if (swung) {
      entry.swings += 1;
    }
  });

  return Array.from(byBatter.entries())
    .map(([batterName, { total, swings }]) => ({
      batterName,
      totalPAs: total,
      swingCount: swings,
      swingRate: total > 0 ? swings / total : 0,
    }))
    .sort((a, b) => b.swingRate - a.swingRate);
}
