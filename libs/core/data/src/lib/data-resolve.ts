import type { GameData, Roster, YearBattingData } from '@ws/core/models';

// --- Seeded PRNG (Mulberry32) ---

function createPrng(seed: number): () => number {
  let s = seed | 0;

  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Fisher-Yates shuffle (deterministic via seeded PRNG) ---

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// --- Session seed (random per page load, consistent within session) ---

const SESSION_SEED = Math.floor(Math.random() * 2147483647);

// --- Name mapping builder ---

type NameMap = Map<string, string>;

/**
 * Builds a name permutation that is consistent within a session but
 * different on every page load. Incorporates the year so different
 * years get distinct shuffles within the same session.
 */
function buildNameMap(names: string[], year: number): NameMap {
  const seed = SESSION_SEED ^ (year * 7919);
  const rand = createPrng(seed);
  const sorted = [...names].sort();
  const shuffled = shuffleArray(sorted, rand);

  const map = new Map<string, string>();

  sorted.forEach((name, i) => {
    map.set(name, shuffled[i]);
  });

  return map;
}

/**
 * Collects all unique Wellesley player names from gamedata.
 * Names are in "last, first" lowercase format.
 */
function collectPlayerNames(games: GameData[]): string[] {
  const names = new Set<string>();

  games.forEach((game) => {
    game.lineup.forEach((players) => {
      players.forEach((name) => {
        names.add(name);
      });
    });
  });

  return [...names];
}

// --- Play-by-play name resolution ---

/**
 * Converts "last, first" → "F. Last" (the format used in play text).
 */
function toPlayFormat(fullName: string): string {
  const [last, first] = fullName.split(', ');
  const capitalLast = last.charAt(0).toUpperCase() + last.slice(1);
  const firstInitial = first.charAt(0).toUpperCase();

  return `${firstInitial}. ${capitalLast}`;
}

/**
 * Resolves play-by-play text by replacing all player name references.
 * Handles truncated names (e.g., "A. Mulher" for "A. Mulhern") by matching
 * the longest prefix and truncating the replacement to the same length.
 */
function resolvePlayText(text: string, nameMap: NameMap): string {
  // Build lookup from play-format names to their replacements
  const playFormatMap = new Map<string, string>();

  nameMap.forEach((toName, fromName) => {
    playFormatMap.set(toPlayFormat(fromName), toPlayFormat(toName));
  });

  // Sort by length descending so longer names match first
  const playNames = [...playFormatMap.keys()].sort((a, b) => b.length - a.length);

  // Build prefix lookup: for each known name, also register truncated forms
  // E.g., "A. Mulhern" registers prefixes "A. Mulher", "A. Mulhe", etc. (min 4 chars)
  const prefixMap = new Map<string, { full: string; replacement: string }>();

  playNames.forEach((name) => {
    const replacement = playFormatMap.get(name)!;
    // Register the full name
    prefixMap.set(name, { full: name, replacement });

    // Register truncated prefixes (min length: "X. Ab" = 5 chars)
    for (let len = name.length - 1; len >= 5; len--) {
      const prefix = name.slice(0, len);

      // Only register if this prefix isn't already a full name or longer prefix
      if (!prefixMap.has(prefix)) {
        prefixMap.set(prefix, { full: name, replacement });
      }
    }
  });

  // Build combined regex from all registered patterns (longest first)
  const allPatterns = [...prefixMap.keys()].sort((a, b) => b.length - a.length);
  const escaped = allPatterns.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(escaped.join('|'), 'g');

  return text.replace(regex, (match) => {
    const entry = prefixMap.get(match);

    if (!entry) {
      return match;
    }

    const { full, replacement } = entry;

    // If the match is shorter than the full name, it's truncated — truncate replacement too
    if (match.length < full.length) {
      return replacement.slice(0, match.length);
    }

    return replacement;
  });
}

// --- Public resolve functions ---

/**
 * Resolves gamedata by shuffling player names in lineups and play-by-play text.
 */
export function resolveGameData(games: GameData[], year: number): GameData[] {
  const names = collectPlayerNames(games);

  if (names.length < 2) {
    return games;
  }

  const nameMap = buildNameMap(names, year);

  return games.map((game) => ({
    ...game,
    lineup: resolveLineup(game.lineup, nameMap),
    playByPlay: game.playByPlay.map((inning) => ({
      ...inning,
      plays: inning.plays.map((play) => resolvePlayText(play, nameMap)),
    })),
  }));
}

function resolveLineup(lineup: Map<number, string[]>, nameMap: NameMap): Map<number, string[]> {
  const resolved = new Map<number, string[]>();

  lineup.forEach((players, slot) => {
    resolved.set(
      slot,
      players.map((name) => nameMap.get(name) ?? name)
    );
  });

  return resolved;
}

/**
 * Resolves YearBattingData by shuffling player names in season stats and boxscores.
 * Uses the same name mapping as gamedata for the same year.
 */
export function resolveYearBattingData(data: YearBattingData, games: GameData[], year: number): YearBattingData {
  const names = collectPlayerNames(games);

  if (names.length < 2) {
    return data;
  }

  const nameMap = buildNameMap(names, year);

  // Build "Last, First" → "Last, First" mapping (batting data uses capitalized format)
  const capitalNameMap = new Map<string, string>();

  nameMap.forEach((toName, fromName) => {
    capitalNameMap.set(capitalizeFullName(fromName), capitalizeFullName(toName));
  });

  return {
    ...data,
    players: data.players.map((p) => ({
      ...p,
      name: capitalNameMap.get(p.name) ?? p.name,
      season: {
        ...p.season,
        name: capitalNameMap.get(p.season.name) ?? p.season.name,
      },
    })),
    boxscores: data.boxscores?.map((box) => ({
      ...box,
      playerStats: box.playerStats.map((ps) => ({
        ...ps,
        name: capitalNameMap.get(ps.name) ?? ps.name,
      })),
    })),
  };
}

/**
 * Resolves roster by shuffling name → entry assignments.
 * Uses the current year's mapping.
 */
export function resolveRoster(roster: Roster, games: GameData[], year: number): Roster {
  const names = collectPlayerNames(games);

  if (names.length < 2) {
    return roster;
  }

  const nameMap = buildNameMap(names, year);
  const resolved: Roster = {};

  Object.entries(roster).forEach(([name, entry]) => {
    const mappedName = nameMap.get(name) ?? name;
    resolved[mappedName] = entry;
  });

  return resolved;
}

/** "last, first" → "Last, First" */
function capitalizeFullName(name: string): string {
  return name
    .split(', ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(', ');
}
