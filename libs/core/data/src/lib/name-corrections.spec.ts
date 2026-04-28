import type { GameData } from '@ws/core/models';

import { applyCorrectionsToGames, buildCorrections } from './name-corrections';

function makeGame(plays: string[], lineup: [number, string[]][] = []): GameData {
  return {
    lineup: new Map(lineup),
    playByPlay: [{ inning: '1st', plays }],
  };
}

describe('name-corrections', () => {
  it('rewrites misspelled names in play-by-play text', () => {
    const built = buildCorrections({
      'Lexi Sealey': ['Lexi Sealy'],
      'Belle DiCampello': ['Belle Dicampello'],
    });
    const games = [makeGame(['Lexi Sealy walked (0-0).', 'Belle Dicampello flied out to cf (0-0).', 'Lexi Sealy advanced to second on a wild pitch.'])];
    const out = applyCorrectionsToGames(games, built);

    expect(out[0].playByPlay[0].plays[0]).toBe('Lexi Sealey walked (0-0).');
    expect(out[0].playByPlay[0].plays[1]).toBe('Belle DiCampello flied out to cf (0-0).');
    expect(out[0].playByPlay[0].plays[2]).toBe('Lexi Sealey advanced to second on a wild pitch.');
  });

  it('rewrites lineup entries in lowercase "last, first" form', () => {
    const built = buildCorrections({
      'Lexi Sealey': ['Lexi Sealy'],
    });
    const games = [makeGame([], [[3, ['sealy, lexi']]])];
    const out = applyCorrectionsToGames(games, built);

    expect(out[0].lineup.get(3)).toEqual(['sealey, lexi']);
  });

  it('leaves names untouched when no correction matches', () => {
    const built = buildCorrections({ 'Lexi Sealey': ['Lexi Sealy'] });
    const games = [makeGame(['Emily Walsh walked (0-0).'])];
    const out = applyCorrectionsToGames(games, built);

    expect(out[0].playByPlay[0].plays[0]).toBe('Emily Walsh walked (0-0).');
  });

  it('handles multiple variants per canonical name', () => {
    const built = buildCorrections({
      'Belle DiCampello': ['Belle Dicampello', 'Belle Decampello'],
    });
    const games = [makeGame(['Belle Dicampello singled.', 'Belle Decampello scored.'])];
    const out = applyCorrectionsToGames(games, built);

    expect(out[0].playByPlay[0].plays[0]).toBe('Belle DiCampello singled.');
    expect(out[0].playByPlay[0].plays[1]).toBe('Belle DiCampello scored.');
  });

  it('returns unchanged games when corrections map is empty', () => {
    const built = buildCorrections(undefined);
    const games = [makeGame(['Lexi Sealy walked.'])];
    const out = applyCorrectionsToGames(games, built);

    expect(out).toBe(games);
  });
});
