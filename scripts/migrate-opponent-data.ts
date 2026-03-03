/**
 * One-time migration: split existing combined batting-stats.json and pitching.json
 * into per-year files (batting-stats-{year}.json, pitching-{year}.json).
 *
 * Current year (2026) gets unsuffixed filenames; historical years get year suffixes.
 *
 * Usage:
 *   npm run migrate-opponents
 *   npm run migrate-opponents -- --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

const CURRENT_YEAR = new Date().getFullYear();

const TEAMS = [
  'babson',
  'clark',
  'coastguard',
  'emerson',
  'mit',
  'salve',
  'smith',
  'springfield',
  'wheaton',
  'wpi',
];

function battingFilename(year: number): string {
  return year === CURRENT_YEAR
    ? 'batting-stats.json'
    : `batting-stats-${year}.json`;
}

function pitchingFilename(year: number): string {
  return year === CURRENT_YEAR ? 'pitching.json' : `pitching-${year}.json`;
}

function parseDryRunFlag(): boolean {
  return process.argv.includes('--dry-run');
}

function writeFile(filePath: string, data: unknown, dryRun: boolean): void {
  const json = JSON.stringify(data, null, 2);

  if (dryRun) {
    console.log(`  [dry-run] Would write: ${filePath}`);
  } else {
    fs.writeFileSync(filePath, json);
    console.log(`  Wrote: ${filePath}`);
  }
}

function deleteFile(filePath: string, dryRun: boolean): void {
  if (dryRun) {
    console.log(`  [dry-run] Would delete: ${filePath}`);
  } else {
    fs.unlinkSync(filePath);
    console.log(`  Deleted: ${filePath}`);
  }
}

function migrateBatting(teamDir: string, slug: string, dryRun: boolean): void {
  const combinedPath = path.join(teamDir, 'batting-stats.json');

  if (!fs.existsSync(combinedPath)) {
    console.log(`  No batting-stats.json found, skipping`);

    return;
  }

  const combined = JSON.parse(fs.readFileSync(combinedPath, 'utf-8'));
  const { domain, scrapedAt, players, teamGamesByYear } = combined;

  // Collect all years that have data
  const yearSet = new Set<number>();
  players.forEach((p: any) => {
    p.seasons?.forEach((s: any) => {
      yearSet.add(s.year);
    });
  });

  // Also include years from teamGamesByYear (may have years with no player data)
  Object.keys(teamGamesByYear || {}).forEach((y) => {
    yearSet.add(Number(y));
  });

  const years = Array.from(yearSet).sort((a, b) => a - b);
  console.log(`  Batting years found: ${years.join(', ')}`);

  // Write per-year files, track if we wrote an unsuffixed current-year file
  let wroteCurrentYear = false;
  years.forEach((year) => {
    const yearPlayers = players
      .filter((p: any) => p.seasons?.some((s: any) => s.year === year))
      .map((p: any) => ({
        name: p.name,
        jerseyNumber: p.jerseyNumber,
        classYear: p.classYear,
        position: p.position,
        bats: p.bats,
        season: p.seasons.find((s: any) => s.year === year),
      }));

    if (yearPlayers.length === 0) {
      return;
    }

    const yearData = {
      slug,
      domain,
      scrapedAt,
      year,
      teamGames: (teamGamesByYear || {})[String(year)] ?? 0,
      players: yearPlayers,
    };

    writeFile(path.join(teamDir, battingFilename(year)), yearData, dryRun);

    if (year === CURRENT_YEAR) {
      wroteCurrentYear = true;
    }
  });

  // Delete old combined file unless we overwrote it with a current-year per-year file
  if (!wroteCurrentYear) {
    deleteFile(combinedPath, dryRun);
  }
}

function migratePitching(
  teamDir: string,
  slug: string,
  dryRun: boolean
): void {
  const combinedPath = path.join(teamDir, 'pitching.json');

  if (!fs.existsSync(combinedPath)) {
    console.log(`  No pitching.json found, skipping`);

    return;
  }

  const combined = JSON.parse(fs.readFileSync(combinedPath, 'utf-8'));
  const { domain, scrapedAt, pitchingStatsByYear, games } = combined;

  // Collect all years
  const yearSet = new Set<number>();
  Object.keys(pitchingStatsByYear || {}).forEach((y) => {
    yearSet.add(Number(y));
  });
  (games || []).forEach((g: any) => {
    yearSet.add(g.year);
  });

  const years = Array.from(yearSet).sort((a, b) => a - b);
  console.log(`  Pitching years found: ${years.join(', ')}`);

  // Write per-year files, track if we wrote an unsuffixed current-year file
  let wroteCurrentYear = false;
  years.forEach((year) => {
    const stats = (pitchingStatsByYear || {})[String(year)] ?? [];
    const yearGames = (games || []).filter((g: any) => g.year === year);

    if (stats.length === 0 && yearGames.length === 0) {
      return;
    }

    const yearData = {
      slug,
      domain,
      scrapedAt,
      year,
      pitchingStats: stats,
      games: yearGames,
    };

    writeFile(path.join(teamDir, pitchingFilename(year)), yearData, dryRun);

    if (year === CURRENT_YEAR) {
      wroteCurrentYear = true;
    }
  });

  // Delete old combined file unless we overwrote it with a current-year per-year file
  if (!wroteCurrentYear) {
    deleteFile(combinedPath, dryRun);
  }
}

function main(): void {
  const dryRun = parseDryRunFlag();
  const opponentsDir = path.resolve(__dirname, '../public/data/opponents');

  console.log(`Migrating opponent data to per-year files`);
  console.log(`Current year: ${CURRENT_YEAR}`);

  if (dryRun) {
    console.log('DRY RUN — no files will be modified\n');
  }

  TEAMS.forEach((slug) => {
    const teamDir = path.join(opponentsDir, slug);

    if (!fs.existsSync(teamDir)) {
      console.log(`\nSkip ${slug} (no directory)`);

      return;
    }

    console.log(`\n=== ${slug} ===`);
    migrateBatting(teamDir, slug, dryRun);
    migratePitching(teamDir, slug, dryRun);
  });

  console.log('\nDone!');
}

main();
