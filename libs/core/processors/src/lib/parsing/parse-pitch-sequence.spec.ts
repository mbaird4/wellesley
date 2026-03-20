import { parsePitchSequence } from './parse-pitch-sequence';

describe('parsePitchSequence', () => {
  it('parses a full pitch sequence with count', () => {
    const result = parsePitchSequence('G. Jones walked (3-1 KBBBB).');
    expect(result).toEqual({
      balls: 3,
      strikes: 1,
      pitches: ['K', 'B', 'B', 'B', 'B'],
      unknownCodes: [],
    });
  });

  it('parses first-pitch put in play (0-0) with empty sequence', () => {
    const result = parsePitchSequence('A. Mulhern singled through the left side (0-0).');
    expect(result).toEqual({
      balls: 0,
      strikes: 0,
      pitches: [],
      unknownCodes: [],
    });
  });

  it('returns null for pre-2026 play text without pitch data', () => {
    const result = parsePitchSequence('A. Delgado singled to center field.');
    expect(result).toBeNull();
  });

  it('flags unknown pitch codes', () => {
    const result = parsePitchSequence('A. Batter struck out (1-2 BXK).');
    expect(result).toEqual({
      balls: 1,
      strikes: 2,
      pitches: ['B', 'K'],
      unknownCodes: ['X'],
    });
  });

  it('parses hit by pitch with H code', () => {
    const result = parsePitchSequence('A. Batter hit by pitch (2-1 FBH).');
    expect(result).toEqual({
      balls: 2,
      strikes: 1,
      pitches: ['F', 'B', 'H'],
      unknownCodes: [],
    });
  });

  it('parses strikeout looking sequence', () => {
    const result = parsePitchSequence('Allison Frost struck out looking (2-2 BBFFFK).');
    expect(result).toEqual({
      balls: 2,
      strikes: 2,
      pitches: ['B', 'B', 'F', 'F', 'F', 'K'],
      unknownCodes: [],
    });
  });

  it('parses play with runner sub-events after pitch sequence', () => {
    const result = parsePitchSequence('B. Mellady singled to right field (0-2 FK); J. Colgan advanced to second.');
    expect(result).toEqual({
      balls: 0,
      strikes: 2,
      pitches: ['F', 'K'],
      unknownCodes: [],
    });
  });

  it('handles text without trailing period', () => {
    const result = parsePitchSequence('G. Jones walked (3-1 KBBBB)');
    expect(result).toEqual({
      balls: 3,
      strikes: 1,
      pitches: ['K', 'B', 'B', 'B', 'B'],
      unknownCodes: [],
    });
  });

  it('parses long foul-ball sequence', () => {
    const result = parsePitchSequence('A. Delgado walked (3-2 FFBFBBFFB).');
    expect(result).toEqual({
      balls: 3,
      strikes: 2,
      pitches: ['F', 'F', 'B', 'F', 'B', 'B', 'F', 'F', 'B'],
      unknownCodes: [],
    });
  });
});
