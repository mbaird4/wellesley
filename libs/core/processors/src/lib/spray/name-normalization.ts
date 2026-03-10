/**
 * Shared name normalization utilities for spray chart components.
 *
 * Handles two common issues across multi-game data:
 * 1. Truncated last names (e.g. "E. Santi" vs "E. Santiago")
 * 2. Wrong first initials (e.g. "A. Walsh" when roster says "Emily Walsh")
 *
 * Matching uses a relaxed key: first initial + first 2 letters of surname.
 * Jersey numbers disambiguate when multiple roster entries share a key.
 */

import type { JerseyMap, Roster, SprayDataPoint } from '@ws/core/models';
import { toJerseyMap } from '@ws/core/models';

/**
 * Build a relaxed match key from a first initial and last name.
 * Returns lowercase key like "e-sa" for ("E", "Santiago").
 */
function buildMatchKey(initial: string, lastName: string): string {
  return `${initial[0].toLowerCase()}-${lastName.slice(0, 2).toLowerCase()}`;
}

interface RosterCandidate {
  jersey: number;
  last: string;
}

/** Parse a "last, first" roster key into its parts. */
function parseRosterKey(key: string): { first: string; last: string } {
  const parts = key.split(',');

  return { last: parts[0].trim(), first: parts[1]?.trim() ?? '' };
}

/** Index roster entries by relaxed match key for O(1) lookup. */
function buildRosterKeyMap(entries: { first: string; last: string; jersey: number }[]): Map<string, RosterCandidate[]> {
  const byKey = new Map<string, RosterCandidate[]>();

  entries.forEach(({ first, last, jersey }) => {
    const mk = buildMatchKey(first, last);
    const group = byKey.get(mk) ?? [];
    group.push({ jersey, last });
    byKey.set(mk, group);
  });

  return byKey;
}

/**
 * Match a display name (e.g. "E. Santiago") against the roster key map.
 * Returns the jersey number if matched, or undefined.
 */
function matchJersey(displayName: string, rosterByKey: Map<string, RosterCandidate[]>): number | undefined {
  const parts = displayName.split(/\s+/);
  const displayInitial = parts[0][0];
  const displayLast = parts.slice(1).join(' ');
  const mk = buildMatchKey(displayInitial, displayLast);
  const candidates = rosterByKey.get(mk);

  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0].jersey;
  }

  // Multiple candidates share the same key — disambiguate with more of the last name
  const best = candidates.find((c) => c.last.toLowerCase().startsWith(displayLast.toLowerCase()) || displayLast.toLowerCase().startsWith(c.last.toLowerCase()));

  return best?.jersey;
}

/**
 * Normalize "Joe Smith" → "J. Smith" so multi-year names merge correctly.
 * Names already in initial format (e.g. "J. Smith") pass through unchanged.
 */
export function normalizePlayerName(name: string): string {
  const parts = name.split(/\s+/);

  if (parts.length < 2) {
    return name;
  }

  const first = parts[0];

  // Already initial format ("J." or "J")
  if (first.length <= 2) {
    return name;
  }

  const rest = parts.slice(1).join(' ');

  return `${first[0]}. ${rest}`;
}

/**
 * Build a rename map that merges truncated last names and corrects wrong first
 * initials by grouping display names by jersey number.
 *
 * @param names - Display names in "F. Last" format (e.g. ["E. Santi", "E. Santiago"])
 * @param rosterJerseyMap - Roster in "last, first" → jersey number format
 * @returns Map from variant name → canonical name (only contains entries that differ)
 */
export function buildCanonicalNameMap(names: string[], rosterJerseyMap: Record<string, number>): Map<string, string> {
  const jerseyToFirstName = new Map<number, string>();
  const entries: { first: string; last: string; jersey: number }[] = [];

  Object.entries(rosterJerseyMap).forEach(([key, jersey]) => {
    const { first, last } = parseRosterKey(key);
    jerseyToFirstName.set(jersey, first);
    entries.push({ first, last, jersey });
  });

  const rosterByKey = buildRosterKeyMap(entries);

  // Match each display name to a jersey number
  const nameToJersey = new Map<string, number>();

  names.forEach((displayName) => {
    const jersey = matchJersey(displayName, rosterByKey);

    if (jersey !== undefined) {
      nameToJersey.set(displayName, jersey);
    }
  });

  // Group by jersey number
  const byJersey = new Map<number, string[]>();

  nameToJersey.forEach((jersey, name) => {
    const group = byJersey.get(jersey) ?? [];
    group.push(name);
    byJersey.set(jersey, group);
  });

  const canonMap = new Map<string, string>();

  byJersey.forEach((group, jersey) => {
    if (group.length <= 1) {
      return;
    }

    // Prefer the name whose initial matches the roster's first name
    const rosterFirst = jerseyToFirstName.get(jersey) ?? '';
    const rosterInitial = rosterFirst[0]?.toUpperCase() ?? '';

    // Among names with the correct initial, pick the longest (handles truncated last names)
    const correctInitial = group.filter((n) => n[0] === rosterInitial);
    const canonical = correctInitial.length > 0 ? correctInitial.reduce((a, b) => (b.length > a.length ? b : a)) : group.reduce((a, b) => (b.length > a.length ? b : a));

    group.forEach((name) => {
      if (name !== canonical) {
        canonMap.set(name, canonical);
      }
    });
  });

  return canonMap;
}

/**
 * Build a map of display names (e.g. "S. Moore") → jersey numbers by matching
 * against the roster using first initial + first 2 letters of surname.
 */
export function buildDisplayJerseyMap(roster: Roster, playerNames: string[], options?: { includeUnmatched?: boolean }): JerseyMap {
  const rosterEntries = Object.entries(roster).map(([key, entry]) => ({
    ...parseRosterKey(key),
    jersey: entry.jersey,
  }));

  const rosterByKey = buildRosterKeyMap(rosterEntries);

  const map: JerseyMap = {};

  playerNames.forEach((displayName) => {
    const jersey = matchJersey(displayName, rosterByKey);

    if (jersey !== undefined) {
      map[displayName] = jersey;
    }
  });

  if (options?.includeUnmatched) {
    const mappedJerseys = new Set(Object.values(map));

    rosterEntries
      .filter((e) => !mappedJerseys.has(e.jersey))
      .forEach(({ first, last, jersey }) => {
        const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
        const displayName = `${titleCase(first)[0]}. ${titleCase(last)}`;
        map[displayName] = jersey;
      });
  }

  return map;
}

/**
 * Merge truncated name variants by grouping on (initial + first 2 chars of surname).
 * Within each group, the longest name wins (e.g. "A. Galbraith" over "A. Galbr").
 * Only returns entries where the variant differs from the canonical.
 */
function mergeTruncatedNames(names: string[]): Map<string, string> {
  const byKey = new Map<string, string[]>();

  names.forEach((name) => {
    const parts = name.split(/\s+/);
    const mk = buildMatchKey(parts[0], parts.slice(1).join(' '));
    const group = byKey.get(mk) ?? [];
    group.push(name);
    byKey.set(mk, group);
  });

  const result = new Map<string, string>();

  byKey.forEach((group) => {
    if (group.length <= 1) {
      return;
    }

    const canonical = group.reduce((a, b) => (b.length > a.length ? b : a));

    group.forEach((name) => {
      if (name !== canonical) {
        result.set(name, canonical);
      }
    });
  });

  return result;
}

/**
 * Canonicalize player names across multiple years of spray data in-place.
 * 1. Normalizes first names to initials ("Joe Smith" → "J. Smith").
 * 2. Merges truncated variants via roster jersey numbers when available.
 * 3. Merges remaining truncated variants by (initial + first 2 chars of surname).
 */
export function canonicalizeSprayNames(dataByYear: Map<number, SprayDataPoint[]>, years: number[], roster: Roster): void {
  dataByYear.forEach((points) => {
    points.forEach((p) => (p.playerName = normalizePlayerName(p.playerName)));
  });

  const collectNames = () => [...new Set(years.flatMap((y) => (dataByYear.get(y) ?? []).map((p) => p.playerName)))];

  const applyMap = (canonMap: Map<string, string>) => {
    if (canonMap.size === 0) {
      return;
    }

    dataByYear.forEach((points) => {
      points.forEach((p) => {
        const canon = canonMap.get(p.playerName);

        if (canon) {
          p.playerName = canon;
        }
      });
    });
  };

  // Pass 1: roster-based canonicalization (jersey number grouping)
  if (Object.keys(roster).length > 0) {
    applyMap(buildCanonicalNameMap(collectNames(), toJerseyMap(roster)));
  }

  // Pass 2: merge remaining truncated variants by (initial + first 2 chars)
  applyMap(mergeTruncatedNames(collectNames()));
}
