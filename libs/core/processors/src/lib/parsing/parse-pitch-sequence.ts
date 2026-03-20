import type { PitchCode, PitchSequence } from '@ws/core/models';

const KNOWN_CODES = new Set<string>(['K', 'S', 'B', 'F', 'H']);

/**
 * Matches pitch sequence pattern anywhere in play text: `(X-Y LETTERS)` or `(X-Y)`.
 * The sequence appears on the batter sub-event, which may be followed by
 * semicolons and runner sub-events (e.g. `"singled (0-2 FK); Runner advanced."`).
 */
const PITCH_SEQ_REGEX = /\((\d+)-(\d+)\s*([A-Z]*)\)/;

/**
 * Parse pitch sequence from play text.
 * Returns null for plays without pitch data (pre-2026 or non-PA events).
 */
export function parsePitchSequence(playText: string): PitchSequence | null {
  const match = playText.match(PITCH_SEQ_REGEX);
  if (!match) {
    return null;
  }

  const balls = parseInt(match[1], 10);
  const strikes = parseInt(match[2], 10);
  const letters = match[3]; // may be empty for (0-0)

  const pitches: PitchCode[] = [];
  const unknownCodes: string[] = [];

  [...letters].forEach((ch) => {
    if (KNOWN_CODES.has(ch)) {
      pitches.push(ch as PitchCode);
    } else {
      unknownCodes.push(ch);
    }
  });

  return { balls, strikes, pitches, unknownCodes };
}
