/**
 * Shared name normalization utilities for spray chart components.
 *
 * Handles two common issues across multi-game data:
 * 1. Truncated last names (e.g. "E. Santi" vs "E. Santiago")
 * 2. Wrong first initials (e.g. "A. Walsh" when roster says "Emily Walsh")
 *
 * Groups display names by jersey number, then picks the canonical form per group.
 */

import type { JerseyMap, Roster, SprayDataPoint } from '@ws/core/models';
import { toJerseyMap } from '@ws/core/models';

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
export function buildCanonicalNameMap(
  names: string[],
  rosterJerseyMap: Record<string, number>
): Map<string, string> {
  const byLastName = new Map<string, number>();
  const jerseyToFirstName = new Map<number, string>();

  Object.entries(rosterJerseyMap).forEach(([key, jersey]) => {
    const parts = key.split(',');
    const last = parts[0].trim();
    const first = parts[1]?.trim() ?? '';
    byLastName.set(last, jersey);
    jerseyToFirstName.set(jersey, first);
  });

  // Match each display name to a jersey number
  const nameToJersey = new Map<string, number>();

  names.forEach((displayName) => {
    const parts = displayName.split(/\s+/);
    const displayLast = parts.slice(1).join(' ').toLowerCase();
    const jersey = byLastName.get(displayLast);

    if (jersey !== undefined) {
      nameToJersey.set(displayName, jersey);

      return;
    }

    // Prefix match for truncated names
    byLastName.forEach((num, rosterLast) => {
      if (nameToJersey.has(displayName)) {
        return;
      }

      if (
        rosterLast.startsWith(displayLast) ||
        displayLast.startsWith(rosterLast)
      ) {
        nameToJersey.set(displayName, num);
      }
    });
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
    const canonical =
      correctInitial.length > 0
        ? correctInitial.reduce((a, b) => (b.length > a.length ? b : a))
        : group.reduce((a, b) => (b.length > a.length ? b : a));

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
 * against the roster using last-name exact match then prefix match.
 */
export function buildDisplayJerseyMap(
  roster: Roster,
  playerNames: string[]
): JerseyMap {
  const map: JerseyMap = {};

  const byLastName = new Map<string, number>();
  Object.entries(roster).forEach(([key, entry]) => {
    const last = key.split(',')[0].trim();
    byLastName.set(last, entry.jersey);
  });

  playerNames.forEach((displayName) => {
    const parts = displayName.split(/\s+/);
    const displayLast = parts.slice(1).join(' ').toLowerCase();
    const jersey = byLastName.get(displayLast);

    if (jersey !== undefined) {
      map[displayName] = jersey;

      return;
    }

    const match = [...byLastName.entries()].find(
      ([rosterLast]) =>
        rosterLast.startsWith(displayLast) || displayLast.startsWith(rosterLast)
    );

    if (match) {
      map[displayName] = match[1];
    }
  });

  return map;
}

/**
 * Canonicalize player names across multiple years of spray data in-place.
 * Normalizes first names to initials, then merges truncated last names and
 * wrong initials using roster jersey numbers.
 */
export function canonicalizeSprayNames(
  dataByYear: Map<number, SprayDataPoint[]>,
  years: number[],
  roster: Roster
): void {
  dataByYear.forEach((points) => {
    points.forEach((p) => (p.playerName = normalizePlayerName(p.playerName)));
  });

  if (Object.keys(roster).length === 0) {
    return;
  }

  const allNames = [
    ...new Set(
      years.flatMap((y) => (dataByYear.get(y) ?? []).map((p) => p.playerName))
    ),
  ];
  const canonMap = buildCanonicalNameMap(allNames, toJerseyMap(roster));

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
}
