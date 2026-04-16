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
  first: string;
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
    group.push({ jersey, last, first });
    byKey.set(mk, group);
  });

  return byKey;
}

/**
 * Match a display name (e.g. "E. Santiago") against the roster key map.
 * Returns the jersey number if matched, or undefined.
 *
 * When multiple candidates share the same key (e.g. "Ma. Bowen" and "Mi. Bowen"
 * for sisters on the same team), uses the full display prefix to disambiguate.
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

  // Verify the last name actually matches (one must be a prefix of the other)
  // Without this, "J. Leal" would falsely match roster entry "lees, jacelyn" via shared key "j-le"
  const lastNameMatches = candidates.filter((c) => c.last.toLowerCase().startsWith(displayLast.toLowerCase()) || displayLast.toLowerCase().startsWith(c.last.toLowerCase()));

  if (lastNameMatches.length === 0) {
    return undefined;
  }

  if (lastNameMatches.length === 1) {
    return lastNameMatches[0].jersey;
  }

  // Multiple candidates with matching last names (e.g. sisters "bowen, maddy" and "bowen, michaella").
  // Use the full display prefix (e.g. "Ma" from "Ma.") to pick the correct one.
  const displayPrefix = parts[0].replace(/\.$/, '').toLowerCase();

  if (displayPrefix.length > 1) {
    const prefixMatch = lastNameMatches.find((c) => c.first.toLowerCase().startsWith(displayPrefix));

    if (prefixMatch) {
      return prefixMatch.jersey;
    }
  }

  return lastNameMatches[0].jersey;
}

/**
 * Normalize "Joe Smith" → "J. Smith" so multi-year names merge correctly.
 * Names already abbreviated (ending with ".") pass through unchanged,
 * including multi-char abbreviations like "Ma. Bowen" or "Mi. Bowen".
 */
export function normalizePlayerName(name: string): string {
  const parts = name.split(/\s+/);

  if (parts.length < 2) {
    return name;
  }

  const first = parts[0];

  // Already abbreviated — preserve as-is (handles "J.", "Ma.", "Mi.", etc.)
  if (first.endsWith('.')) {
    return name;
  }

  // Single letter without dot (e.g. "J Smith")
  if (first.length === 1) {
    return `${first}. ${parts.slice(1).join(' ')}`;
  }

  // Full first name — abbreviate to initial
  const rest = parts.slice(1).join(' ');

  return `${first[0]}. ${rest}`;
}

/**
 * Normalize a batch of full player names, using extended prefixes to disambiguate
 * when two names would collide (e.g. "Maddy Bowen" + "Michaella Bowen" → "Ma. Bowen" + "Mi. Bowen").
 */
export function normalizePlayerNames(names: string[]): Map<string, string> {
  const result = new Map<string, string>();

  // Group by what normalizePlayerName would produce
  const groups = new Map<string, string[]>();

  names.forEach((name) => {
    const norm = normalizePlayerName(name);
    const group = groups.get(norm) ?? [];
    group.push(name);
    groups.set(norm, group);
  });

  groups.forEach((group, normName) => {
    if (group.length === 1) {
      result.set(group[0], normName);

      return;
    }

    // Collision — extend the prefix to disambiguate
    for (let len = 2; len <= 10; len++) {
      const prefixed = group.map((name) => {
        const first = name.split(/\s+/)[0].replace(/\.$/, '');
        const rest = name.split(/\s+/).slice(1).join(' ');

        return { name, prefix: first.slice(0, len), rest };
      });

      if (new Set(prefixed.map((p) => p.prefix.toLowerCase())).size === group.length) {
        prefixed.forEach(({ name, prefix, rest }) => {
          result.set(name, `${prefix.charAt(0).toUpperCase()}${prefix.slice(1).toLowerCase()}. ${rest}`);
        });

        return;
      }
    }

    // Fallback: use full names
    group.forEach((name) => result.set(name, name));
  });

  return result;
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
  const jerseyToLastName = new Map<number, string>();
  const entries: { first: string; last: string; jersey: number }[] = [];

  Object.entries(rosterJerseyMap).forEach(([key, jersey]) => {
    const { first, last } = parseRosterKey(key);
    jerseyToFirstName.set(jersey, first);
    jerseyToLastName.set(jersey, last);
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

  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const canonMap = new Map<string, string>();

  byJersey.forEach((group, jersey) => {
    // Prefer the name whose initial matches the roster's first name
    const rosterFirst = jerseyToFirstName.get(jersey) ?? '';
    const rosterInitial = rosterFirst[0]?.toUpperCase() ?? '';
    const rosterLast = jerseyToLastName.get(jersey) ?? '';

    // Include the roster's canonical "F. Last" as a candidate so single-variant
    // truncated spray names (e.g. "K. Copperthi") get expanded via the roster.
    const rosterCanonical = rosterLast ? `${rosterInitial}. ${titleCase(rosterLast)}` : '';
    const candidates = rosterCanonical && !group.includes(rosterCanonical) ? [...group, rosterCanonical] : group;

    if (candidates.length <= 1) {
      return;
    }

    // Among names with the correct initial, pick the longest (handles truncated last names)
    const correctInitial = candidates.filter((n) => n[0] === rosterInitial);
    const canonical = correctInitial.length > 0 ? correctInitial.reduce((a, b) => (b.length > a.length ? b : a)) : candidates.reduce((a, b) => (b.length > a.length ? b : a));

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

    // Only merge names where one surname is a prefix of another (actual truncation).
    // E.g. "E. Santi" / "E. Santiago" merge, but "J. Lees" / "J. Leal" do not.
    const getLast = (n: string) => n.split(/\s+/).slice(1).join(' ').toLowerCase();

    group.forEach((name) => {
      const nameLast = getLast(name);
      const longerMatch = group.find((other) => {
        if (other === name || other.length <= name.length) {
          return false;
        }

        const otherLast = getLast(other);

        return otherLast.startsWith(nameLast);
      });

      if (longerMatch) {
        result.set(name, longerMatch);
      }
    });
  });

  return result;
}

/**
 * Detect roster entries whose standard "F. Last" abbreviation would collide,
 * and return a map from the ambiguous abbreviation to a resolution table.
 *
 * E.g. roster has "bowen, maddy" (#17) and "bowen, michaella" (#20) — both
 * abbreviate to "M. Bowen". Returns: "M. Bowen" → Map{"maddy" → "Ma. Bowen", "michaella" → "Mi. Bowen"}.
 */
function buildRosterCollisionMap(roster: Roster): Map<string, Map<string, string>> {
  const entries = Object.keys(roster).map((key) => {
    const { first, last } = parseRosterKey(key);
    const titleLast = last.charAt(0).toUpperCase() + last.slice(1);
    const standard = `${first.charAt(0).toUpperCase()}. ${titleLast}`;

    return { first, titleLast, standard };
  });

  // Group by standard abbreviation
  const groups = new Map<string, typeof entries>();

  entries.forEach((e) => {
    const group = groups.get(e.standard) ?? [];
    group.push(e);
    groups.set(e.standard, group);
  });

  const result = new Map<string, Map<string, string>>();

  groups.forEach((group, standard) => {
    if (group.length <= 1) {
      return;
    }

    for (let len = 2; len <= 10; len++) {
      const prefixes = group.map((e) => e.first.slice(0, len).toLowerCase());

      if (new Set(prefixes).size === group.length) {
        const alts = new Map<string, string>();

        group.forEach((e) => {
          const prefix = e.first.slice(0, len);
          const uniqueName = `${prefix.charAt(0).toUpperCase()}${prefix.slice(1).toLowerCase()}. ${e.titleLast}`;
          alts.set(e.first.toLowerCase(), uniqueName);
        });
        result.set(standard, alts);

        return;
      }
    }
  });

  return result;
}

/**
 * Canonicalize player names across multiple years of spray data in-place.
 * 1. Normalizes first names to initials ("Joe Smith" → "J. Smith"), using
 *    extended prefixes when the roster has collisions ("Maddy Bowen" → "Ma. Bowen").
 * 2. Merges truncated variants via roster jersey numbers when available.
 * 3. Merges remaining truncated variants by (initial + first 2 chars of surname).
 */
export function canonicalizeSprayNames(dataByYear: Map<number, SprayDataPoint[]>, years: number[], roster: Roster): void {
  const collisions = Object.keys(roster).length > 0 ? buildRosterCollisionMap(roster) : new Map();

  // Normalize player names, resolving collisions via roster when possible
  dataByYear.forEach((points) => {
    points.forEach((p) => {
      const normalized = normalizePlayerName(p.playerName);
      const alts = collisions.get(normalized);

      if (alts) {
        // This abbreviation is ambiguous — use the original name's first part to resolve
        const rawFirst = p.playerName.split(/\s+/)[0].replace(/\.$/, '').toLowerCase();

        for (const [rosterFirst, uniqueName] of alts) {
          if (rosterFirst.startsWith(rawFirst) || rawFirst.startsWith(rosterFirst)) {
            p.playerName = uniqueName;

            return;
          }
        }
      }

      p.playerName = normalized;
    });
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
