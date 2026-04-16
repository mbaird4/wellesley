import type { BatHand, CareerStats, GamePbP, PitchingData, PitchingStats, Roster, RosterPlayer, SeasonStats, Team, YearBattingData, YearPitchingData } from '@ws/core/models';
import { calculateWoba } from '@ws/core/processors';

/**
 * Convert a roster key ("last, first") to display name ("First Last").
 */
function rosterKeyToDisplayName(key: string): string {
  const parts = key.split(',').map((s) => s.trim());
  const last = parts[0] || '';
  const first = parts[1] || '';

  // Title-case each word
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

  return `${titleCase(first)} ${titleCase(last)}`;
}

/**
 * Normalize a display name to lowercase "last, first" format for roster matching.
 */
function displayNameToRosterKey(name: string): string {
  const parts = name.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ') || '';

  return `${last}, ${first}`.toLowerCase().replace(/\./g, '');
}

/** Canonical grouping key: lowercased, no periods, whitespace-collapsed. */
function canonicalPlayerKey(name: string): string {
  return name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Merge multiple per-year batting data files into the combined Team shape.
 * Career stats are computed client-side from the loaded per-year seasons.
 *
 * If a roster is provided, players on the roster but missing from batting data
 * are included with empty stats so the full team is visible.
 */
export function mergeBattingYears(years: YearBattingData[], roster?: Roster | null): Team {
  if (years.length === 0 && !roster) {
    return { slug: '', domain: '', scrapedAt: '', players: [] };
  }

  const sorted = [...years].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];

  // Build teamGamesByYear from each file's teamGames
  const teamGamesByYear: Record<string, number> = {};
  sorted.forEach((y) => {
    teamGamesByYear[String(y.year)] = y.teamGames;
  });

  // Group players by canonical name key across years so casing/period variations
  // (e.g. "Grace DiBacco" vs "Grace Dibacco") merge into one player.
  const playerMap = new Map<
    string,
    {
      displayName: string;
      seasons: SeasonStats[];
      jerseyNumber: number | null;
      classYear: string;
      position: string | null;
      bats: BatHand | null;
    }
  >();

  sorted.forEach((yearData) => {
    yearData.players.forEach((p) => {
      const key = canonicalPlayerKey(p.name);
      const existing = playerMap.get(key);

      if (existing) {
        existing.seasons.push(p.season);
        // Use most recent year's spelling + roster info
        existing.displayName = p.name;
        existing.jerseyNumber = p.jerseyNumber;
        existing.classYear = p.classYear;
        existing.position = p.position;
        existing.bats = p.bats;
      } else {
        playerMap.set(key, {
          displayName: p.name,
          seasons: [p.season],
          jerseyNumber: p.jerseyNumber,
          classYear: p.classYear,
          position: p.position,
          bats: p.bats,
        });
      }
    });
  });

  // Add roster players missing from batting data
  if (roster) {
    const existingRosterKeys = new Set(Array.from(playerMap.values()).map((v) => displayNameToRosterKey(v.displayName)));

    Object.entries(roster).forEach(([rosterKey, entry]) => {
      if (!existingRosterKeys.has(rosterKey)) {
        const displayName = rosterKeyToDisplayName(rosterKey);
        playerMap.set(canonicalPlayerKey(displayName), {
          displayName,
          seasons: [],
          jerseyNumber: entry.jersey,
          classYear: entry.classYear,
          position: entry.position,
          bats: entry.bats,
        });
      }
    });
  }

  // Build players with computed career stats
  const players: RosterPlayer[] = Array.from(playerMap.values()).map((data) => ({
    name: data.displayName,
    jerseyNumber: data.jerseyNumber,
    classYear: data.classYear,
    position: data.position,
    bats: data.bats,
    seasons: data.seasons,
    career: computeCareerStats(data.seasons),
  }));

  // Sort by career wOBA descending
  players.sort((a, b) => b.career.woba - a.career.woba);

  return {
    slug: latest?.slug ?? '',
    domain: latest?.domain ?? '',
    scrapedAt: latest?.scrapedAt ?? '',
    players,
    teamGamesByYear,
  };
}

/**
 * Compute career stats from an array of season stats.
 * Sums counting stats, then derives rate stats + wOBA.
 */
export function computeCareerStats(seasons: SeasonStats[]): CareerStats {
  const totals = {
    gp: 0,
    gs: 0,
    ab: 0,
    r: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    rbi: 0,
    tb: 0,
    bb: 0,
    hbp: 0,
    so: 0,
    gdp: 0,
    sf: 0,
    sh: 0,
    sb: 0,
    sbAtt: 0,
  };

  seasons.forEach((s) => {
    totals.gp += s.gp;
    totals.gs += s.gs;
    totals.ab += s.ab;
    totals.r += s.r;
    totals.h += s.h;
    totals.doubles += s.doubles;
    totals.triples += s.triples;
    totals.hr += s.hr;
    totals.rbi += s.rbi;
    totals.tb += s.tb;
    totals.bb += s.bb;
    totals.hbp += s.hbp;
    totals.so += s.so;
    totals.gdp += s.gdp;
    totals.sf += s.sf;
    totals.sh += s.sh;
    totals.sb += s.sb;
    totals.sbAtt += s.sbAtt;
  });

  const pa = totals.ab + totals.bb + totals.sf + totals.sh + totals.hbp;
  const woba = calculateWoba(totals);
  const avg = totals.ab > 0 ? Math.round((totals.h / totals.ab) * 1000) / 1000 : 0;
  const slg = totals.ab > 0 ? Math.round((totals.tb / totals.ab) * 1000) / 1000 : 0;
  const obp = pa > 0 ? Math.round(((totals.h + totals.bb + totals.hbp) / (totals.ab + totals.bb + totals.hbp + totals.sf)) * 1000) / 1000 : 0;
  const ops = Math.round((slg + obp) * 1000) / 1000;

  return {
    ...totals,
    avg,
    ops,
    slg,
    obp,
    woba: Math.round(woba * 1000) / 1000,
    pa,
  };
}

/**
 * Merge multiple per-year pitching data files into the combined PitchingData shape.
 */
export function mergePitchingYears(years: YearPitchingData[]): PitchingData {
  if (years.length === 0) {
    return {
      slug: '',
      domain: '',
      scrapedAt: '',
      pitchingStatsByYear: {},
      games: [],
    };
  }

  const sorted = [...years].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];

  const pitchingStatsByYear: Record<string, PitchingStats[]> = {};
  const allGames: GamePbP[] = [];

  sorted.forEach((yearData) => {
    pitchingStatsByYear[String(yearData.year)] = yearData.pitchingStats;
    allGames.push(...yearData.games);
  });

  return {
    slug: latest.slug,
    domain: latest.domain,
    scrapedAt: latest.scrapedAt,
    pitchingStatsByYear,
    games: allGames,
  };
}
