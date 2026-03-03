/**
 * Annual season rotation script. Run on ~Feb 10 each year to archive
 * last season's data files and create fresh empty ones for the new season.
 *
 * What it does:
 *   1. Renames current unsuffixed files → year-suffixed (e.g. gamedata.json → gamedata-2025.json)
 *   2. Creates empty current-year files (gamedata.json, wobadata.json, etc.)
 *   3. Deletes opponent data older than the 4-year window
 *   4. Scrapes fresh rosters for Wellesley and all opponents
 *
 * Usage:
 *   npm run rotate-season
 *   npm run rotate-season -- --dry-run     # preview changes without writing
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Teams (same as scrape-opponents.ts) ──

const TEAMS: Record<string, string> = {
  wpi: 'athletics.wpi.edu',
  wheaton: 'wheatoncollegelyons.com',
  springfield: 'springfieldcollegepride.com',
  smith: 'gosmithbears.com',
  salve: 'salveathletics.com',
  mit: 'mitathletics.com',
  emerson: 'emersonlions.com',
  coastguard: 'coastguardathletics.com',
  clark: 'clarkathletics.com',
  babson: 'babsonathletics.com',
};

// ── Constants ──

const BASE_URL = 'https://wellesleyblue.com';
const YEAR_WINDOW = 4;
const DELAY_MS = 500;

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// ── Utilities ──

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name: string): string {
  return name.replace(/\./g, '').trim().toLowerCase();
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'text',
      headers: HEADERS,
    });
    const html = response.data;

    if (!html || html.length < 500) {
      return null;
    }

    return html;
  } catch {
    return null;
  }
}

function parseDryRunFlag(): boolean {
  return process.argv.includes('--dry-run');
}

function renameIfExists(src: string, dest: string, dryRun: boolean): void {
  if (!fs.existsSync(src)) {
    console.log(`  Skip (not found): ${src}`);

    return;
  }

  if (dryRun) {
    console.log(`  [dry-run] Would rename: ${src} → ${dest}`);
  } else {
    fs.renameSync(src, dest);
    console.log(`  Renamed: ${src} → ${dest}`);
  }
}

function writeFile(filePath: string, content: string, dryRun: boolean): void {
  if (dryRun) {
    console.log(`  [dry-run] Would write: ${filePath}`);
  } else {
    fs.writeFileSync(filePath, content);
    console.log(`  Wrote: ${filePath}`);
  }
}

function deleteIfExists(filePath: string, dryRun: boolean): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  if (dryRun) {
    console.log(`  [dry-run] Would delete: ${filePath}`);
  } else {
    fs.unlinkSync(filePath);
    console.log(`  Deleted: ${filePath}`);
  }
}

// ── Roster parsing (same as prefetch-data.ts) ──

function parseWellesleyRoster($: cheerio.CheerioAPI): Record<string, number> {
  const jerseyMap: Record<string, number> = {};

  $('tr').each((_, row) => {
    const jersey = $(row).find('.roster_jerseynum').text().trim();
    const name = $(row).find('.sidearm-table-player-name').text().trim();

    if (!jersey || !name) {
      return;
    }

    const normalized = normalizeName(name);
    const parts = normalized.split(/\s+/);
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    const key = `${last}, ${first}`;
    jerseyMap[key] = parseInt(jersey, 10);
  });

  return jerseyMap;
}

function parseOpponentRoster($: cheerio.CheerioAPI): Record<string, number> {
  const jerseyMap: Record<string, number> = {};

  $('.sidearm-roster-player').each((_, el) => {
    const $el = $(el);
    const fullName = $el.find('h3 a').text().trim();

    if (!fullName) {
      return;
    }

    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const normalized = normalizeName(`${lastName}, ${firstName}`);

    const jerseyText = $el
      .find('.sidearm-roster-player-jersey-number')
      .text()
      .trim();
    const jerseyNumber = jerseyText ? parseInt(jerseyText, 10) : null;

    if (jerseyNumber !== null) {
      jerseyMap[normalized] = jerseyNumber;
    }
  });

  return jerseyMap;
}

// ── Main ──

async function main(): Promise<void> {
  const dryRun = parseDryRunFlag();
  const newYear = new Date().getFullYear();
  const prevYear = newYear - 1;
  const oldestYear = newYear - YEAR_WINDOW;
  const dataDir = path.resolve(__dirname, '../public/data');
  const opponentsDir = path.join(dataDir, 'opponents');

  console.log(`Season rotation: ${prevYear} → ${newYear}`);
  console.log(`4-year window: ${newYear - 3}–${newYear}`);
  console.log(
    `Oldest to keep: ${newYear - 3} (deleting ${oldestYear} and older)`
  );

  if (dryRun) {
    console.log('DRY RUN — no files will be modified\n');
  }

  // 1. Rotate Wellesley data
  console.log('\n=== Rotating Wellesley data ===');
  renameIfExists(
    path.join(dataDir, 'gamedata.json'),
    path.join(dataDir, `gamedata-${prevYear}.json`),
    dryRun
  );
  renameIfExists(
    path.join(dataDir, 'wobadata.json'),
    path.join(dataDir, `wobadata-${prevYear}.json`),
    dryRun
  );
  renameIfExists(
    path.join(dataDir, 'pitching.json'),
    path.join(dataDir, `pitching-${prevYear}.json`),
    dryRun
  );
  writeFile(path.join(dataDir, 'gamedata.json'), '[]', dryRun);
  writeFile(
    path.join(dataDir, 'wobadata.json'),
    JSON.stringify({ seasonStats: [], boxscores: [] }),
    dryRun
  );
  writeFile(
    path.join(dataDir, 'pitching.json'),
    JSON.stringify({
      slug: 'wellesley',
      domain: 'wellesleyblue.com',
      scrapedAt: new Date().toISOString(),
      year: newYear,
      pitchingStats: [],
      games: [],
    }),
    dryRun
  );

  // 2. Rotate opponent data
  console.log('\n=== Rotating opponent data ===');
  Object.keys(TEAMS).forEach((slug) => {
    const teamDir = path.join(opponentsDir, slug);

    if (!fs.existsSync(teamDir)) {
      console.log(`  Skip (no directory): ${slug}`);

      return;
    }

    console.log(`\n  --- ${slug} ---`);

    // Archive current files
    renameIfExists(
      path.join(teamDir, 'batting-stats.json'),
      path.join(teamDir, `batting-stats-${prevYear}.json`),
      dryRun
    );
    renameIfExists(
      path.join(teamDir, 'pitching.json'),
      path.join(teamDir, `pitching-${prevYear}.json`),
      dryRun
    );
    renameIfExists(
      path.join(teamDir, 'gamedata.json'),
      path.join(teamDir, `gamedata-${prevYear}.json`),
      dryRun
    );

    // Create empty current-year files (per-year format)
    writeFile(
      path.join(teamDir, 'batting-stats.json'),
      JSON.stringify({
        slug,
        domain: TEAMS[slug],
        scrapedAt: new Date().toISOString(),
        year: newYear,
        teamGames: 0,
        players: [],
      }),
      dryRun
    );
    writeFile(
      path.join(teamDir, 'pitching.json'),
      JSON.stringify({
        slug,
        domain: TEAMS[slug],
        scrapedAt: new Date().toISOString(),
        year: newYear,
        pitchingStats: [],
        games: [],
      }),
      dryRun
    );

    // Delete data older than the 4-year window
    ['batting-stats', 'pitching', 'gamedata'].forEach((base) => {
      // Delete anything at or before oldestYear
      for (let y = oldestYear; y >= oldestYear - 2; y--) {
        deleteIfExists(path.join(teamDir, `${base}-${y}.json`), dryRun);
      }
    });
  });

  // 3. Scrape fresh rosters
  if (dryRun) {
    console.log('\n=== [dry-run] Would scrape rosters ===');
  } else {
    console.log('\n=== Scraping Wellesley roster ===');
    const wellesleyHtml = await fetchPage(`${BASE_URL}/sports/softball/roster`);

    if (wellesleyHtml) {
      const $ = cheerio.load(wellesleyHtml);
      const roster = parseWellesleyRoster($);
      const rosterPath = path.join(dataDir, 'roster.json');
      const existingRoster: Record<string, number> = fs.existsSync(rosterPath)
        ? JSON.parse(fs.readFileSync(rosterPath, 'utf-8'))
        : {};
      const existingCount = Object.keys(existingRoster).length;
      const newCount = Object.keys(roster).length;

      fs.writeFileSync(rosterPath, JSON.stringify(roster));
      console.log(
        `  Wrote ${rosterPath} (${newCount} players, was ${existingCount})`
      );

      if (newCount !== existingCount) {
        console.log('  ↑ Roster appears updated');
      } else {
        console.log('  Roster player count unchanged');
      }
    } else {
      console.log('  Could not fetch Wellesley roster page');
    }

    console.log('\n=== Scraping opponent rosters ===');

    for (const [slug, domain] of Object.entries(TEAMS)) {
      console.log(`  ${slug}...`);
      await delay(DELAY_MS);
      const html = await fetchPage(`https://${domain}/sports/softball/roster`);

      if (!html) {
        console.log(`    Could not fetch roster`);
        continue;
      }

      const $ = cheerio.load(html);
      const roster = parseOpponentRoster($);
      const teamDir = path.join(opponentsDir, slug);
      fs.mkdirSync(teamDir, { recursive: true });
      const rosterPath = path.join(teamDir, 'roster.json');
      fs.writeFileSync(rosterPath, JSON.stringify(roster));
      console.log(
        `    Wrote ${rosterPath} (${Object.keys(roster).length} players)`
      );
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
