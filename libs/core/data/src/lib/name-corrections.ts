import type { GameData } from '@ws/core/models';

/** Per-year, per-team known misspellings. canonical → list of misspelled variants. */
export type NameCorrectionsFile = Record<string, Record<string, Record<string, string[]>>>;

interface BuiltCorrections {
  playText: Map<string, string>;
  lineup: Map<string, string>;
  pattern: RegExp | null;
}

const EMPTY: BuiltCorrections = { playText: new Map(), lineup: new Map(), pattern: null };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fullToLineupKey(name: string): string {
  const parts = name.trim().split(/\s+/);

  if (parts.length < 2) {
    return name.toLowerCase();
  }

  const first = parts[0];
  const last = parts.slice(1).join(' ');

  return `${last}, ${first}`.toLowerCase();
}

export function buildCorrections(byCanonical: Record<string, string[]> | undefined): BuiltCorrections {
  if (!byCanonical) {
    return EMPTY;
  }

  const playText = new Map<string, string>();
  const lineup = new Map<string, string>();

  Object.entries(byCanonical).forEach(([canonical, misspellings]) => {
    misspellings.forEach((m) => {
      playText.set(m, canonical);
      lineup.set(fullToLineupKey(m), fullToLineupKey(canonical));
    });
  });

  if (playText.size === 0) {
    return EMPTY;
  }

  const pattern = new RegExp([...playText.keys()].map(escapeRegex).join('|'), 'g');

  return { playText, lineup, pattern };
}

export function applyCorrectionsToGames(games: GameData[], built: BuiltCorrections): GameData[] {
  if (!built.pattern) {
    return games;
  }

  return games.map((g) => ({
    ...g,
    lineup: applyLineupCorrections(g.lineup, built.lineup),
    playByPlay: g.playByPlay.map((inn) => ({
      ...inn,
      plays: inn.plays.map((p) => p.replace(built.pattern!, (m) => built.playText.get(m) ?? m)),
    })),
  }));
}

function applyLineupCorrections(lineup: Map<number, string[]>, lineupMap: Map<string, string>): Map<number, string[]> {
  if (lineupMap.size === 0) {
    return lineup;
  }

  return new Map([...lineup.entries()].map(([slot, names]) => [slot, names.map((n) => lineupMap.get(n) ?? n)]));
}
