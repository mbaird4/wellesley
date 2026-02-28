/**
 * Scrape opponent team rosters and all batting stats (with derived wOBA).
 *
 * Usage:
 *   npm run scrape-opponents                         # all teams
 *   npm run scrape-opponents -- --team wpi            # single team
 *   npm run scrape-opponents -- --years 2024,2025     # override years
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Teams ──

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

// ── Types ──

interface RosterPlayer {
  name: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  classYear: string;
}

interface BattingStats {
  name: string;
  avg: number;
  ops: number;
  gp: number;
  gs: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  tb: number;
  slg: number;
  bb: number;
  hbp: number;
  so: number;
  gdp: number;
  obp: number;
  sf: number;
  sh: number;
  sb: number;
  sbAtt: number;
}

interface SeasonStats extends BattingStats {
  year: number;
  woba: number;
  pa: number;
}

interface CareerStats {
  avg: number;
  ops: number;
  gp: number;
  gs: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  tb: number;
  slg: number;
  bb: number;
  hbp: number;
  so: number;
  gdp: number;
  obp: number;
  sf: number;
  sh: number;
  sb: number;
  sbAtt: number;
  woba: number;
  pa: number;
}

interface PlayerOutput {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  seasons: SeasonStats[];
  career: CareerStats;
}

interface TeamOutput {
  slug: string;
  domain: string;
  scrapedAt: string;
  players: PlayerOutput[];
}

// ── Constants ──

const DELAY_MS = 500;
const DEFAULT_YEARS = [2025, 2024, 2023];

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// ── Utilities (same as prefetch-data.ts) ──

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
      console.warn(
        `  Skipping ${url}: response too short (${html?.length ?? 0} chars)`
      );
      return null;
    }
    return html;
  } catch (error: any) {
    console.warn(`  Failed to fetch ${url}: ${error.message}`);
    return null;
  }
}

// ── wOBA calculation (inlined from src/lib/woba.ts) ──

function calculateWoba(stats: {
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
}): number {
  const singles = stats.h - stats.doubles - stats.triples - stats.hr;
  const denominator = stats.ab + stats.bb + stats.sf + stats.sh + stats.hbp;
  if (denominator === 0) return 0;
  const numerator =
    0.5 * stats.bb +
    0.5 * stats.hbp +
    0.9 * singles +
    1.2 * stats.doubles +
    1.7 * stats.triples +
    2.5 * stats.hr;
  return numerator / denominator;
}

// ── Roster parsing ──

function parseRoster($: cheerio.CheerioAPI): RosterPlayer[] {
  const players: RosterPlayer[] = [];

  $('.sidearm-roster-player').each((_, el) => {
    const $el = $(el);

    // Name lives in h3 > a (e.g. "Emily Aiello")
    const fullName = $el.find('h3 a').text().trim();
    if (!fullName) return;

    // Split "First Last" into parts — handle multi-word last names best-effort
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const jerseyText = $el
      .find('.sidearm-roster-player-jersey-number')
      .text()
      .trim();
    const jerseyNumber = jerseyText ? parseInt(jerseyText, 10) : null;

    // Two .sidearm-roster-player-academic-year elements: abbreviated ("Sr.") and full ("Senior")
    // Take the last (full) one
    const classYearEls = $el.find('.sidearm-roster-player-academic-year');
    const classYear =
      classYearEls.length > 1
        ? $(classYearEls[classYearEls.length - 1])
            .text()
            .trim()
        : classYearEls.text().trim();

    players.push({
      name: fullName,
      firstName,
      lastName,
      jerseyNumber,
      classYear,
    });
  });

  return players;
}

// ── Stats table parsing (same logic as prefetch-data.ts) ──

function parseStatsTable($: cheerio.CheerioAPI): BattingStats[] {
  const players: BattingStats[] = [];

  let targetTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (caption.includes('Individual Overall Batting Statistics')) {
      targetTable = $(table);
      return false;
    }
  });

  if (!targetTable) return players;

  targetTable.find('tbody tr').each((_: number, row: any) => {
    const $row = $(row);
    const nameCell = $row.find('th[scope="row"]');
    const name =
      nameCell.find('a.hide-on-medium-down').text().trim() ||
      nameCell.find('a').first().text().trim() ||
      nameCell.text().trim();

    if (
      !name ||
      name.toLowerCase() === 'totals' ||
      name.toLowerCase() === 'opponents'
    )
      return;

    const num = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);
      return parseInt(cell.text().trim(), 10) || 0;
    };

    const pct = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);
      return parseFloat(cell.text().trim()) || 0;
    };

    // GP-GS column is formatted "gp-gs" (e.g. "35-35")
    const gpGsCell = $row.find('td[data-label="GP-GS"]').text().trim();
    const gpGsMatch = gpGsCell.match(/^(\d+)-(\d+)$/);
    const gp = gpGsMatch ? parseInt(gpGsMatch[1], 10) : 0;
    const gs = gpGsMatch ? parseInt(gpGsMatch[2], 10) : 0;

    // SB column (data-label="SB") is formatted "sb-att" (e.g. "12-15")
    const sbAttCell = $row.find('td[data-label="SB"]').text().trim();
    const sbAttMatch = sbAttCell.match(/^(\d+)-(\d+)$/);
    const sb = sbAttMatch ? parseInt(sbAttMatch[1], 10) : 0;
    const sbAtt = sbAttMatch ? parseInt(sbAttMatch[2], 10) : 0;

    players.push({
      name,
      avg: pct('AVG'),
      ops: pct('OPS'),
      gp,
      gs,
      ab: num('AB'),
      r: num('R'),
      h: num('H'),
      doubles: num('2B'),
      triples: num('3B'),
      hr: num('HR'),
      rbi: num('RBI'),
      tb: num('TB'),
      slg: pct('SLG%'),
      bb: num('BB'),
      hbp: num('HBP'),
      so: num('SO'),
      gdp: num('GDP'),
      obp: pct('OB%'),
      sf: num('SF'),
      sh: num('SH'),
      sb,
      sbAtt,
    });
  });

  return players;
}

// ── Name matching ──

function toNormalizedKey(first: string, last: string): string {
  return normalizeName(`${last}, ${first}`);
}

function statsNameToKey(statsName: string): string {
  // Stats names are "Last, First" format
  return normalizeName(statsName);
}

function lastNameOnly(key: string): string {
  return key.split(',')[0].trim();
}

// ── CLI arg parsing ──

function parseTeamArg(): string | null {
  const idx = process.argv.indexOf('--team');
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1].trim().toLowerCase();
}

function parseYearsArg(): number[] {
  const idx = process.argv.indexOf('--years');
  if (idx === -1 || idx + 1 >= process.argv.length) return DEFAULT_YEARS;
  return process.argv[idx + 1]
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

// ── Per-team scraping ──

async function scrapeTeam(
  slug: string,
  domain: string,
  years: number[]
): Promise<TeamOutput> {
  console.log(`\n=== ${slug} (${domain}) ===`);

  // 1. Fetch roster
  console.log('  Fetching roster...');
  const rosterHtml = await fetchPage(
    `https://${domain}/sports/softball/roster`
  );
  const roster = rosterHtml ? parseRoster(cheerio.load(rosterHtml)) : [];
  console.log(`  Found ${roster.length} roster players`);

  // 2. Fetch stats for each year
  const statsByYear = new Map<number, BattingStats[]>();
  for (const year of years) {
    await delay(DELAY_MS);
    console.log(`  Fetching ${year} stats...`);
    const statsHtml = await fetchPage(
      `https://${domain}/sports/softball/stats/${year}`
    );
    if (statsHtml) {
      const stats = parseStatsTable(cheerio.load(statsHtml));
      statsByYear.set(year, stats);
      console.log(`    Parsed ${stats.length} players`);
    } else {
      console.log(`    No stats page for ${year}`);
    }
  }

  // 3. Build a stats lookup: normalizedKey → { year → BattingStats }
  const statsLookup = new Map<string, Map<number, BattingStats>>();
  for (const [year, stats] of statsByYear) {
    for (const s of stats) {
      const key = statsNameToKey(s.name);
      if (!statsLookup.has(key)) statsLookup.set(key, new Map());
      statsLookup.get(key)!.set(year, s);
    }
  }

  // 4. Match roster players to stats and compute wOBA
  // Two-pass matching: exact first, then surname fallback against unclaimed entries
  const rosterWithKeys = roster.map((rp) => ({
    rp,
    rosterKey: toNormalizedKey(rp.firstName, rp.lastName),
  }));

  // Pass 1: exact matches
  const matchResults = new Map<
    (typeof roster)[number],
    Map<number, BattingStats>
  >();
  const claimedStatsKeys = new Set<string>();
  for (const { rp, rosterKey } of rosterWithKeys) {
    const exact = statsLookup.get(rosterKey);
    if (exact) {
      matchResults.set(rp, exact);
      claimedStatsKeys.add(rosterKey);
    }
  }

  // Pass 2: surname fallback for unmatched — only if exactly one unclaimed entry shares the surname
  for (const { rp, rosterKey } of rosterWithKeys) {
    if (matchResults.has(rp)) continue;
    const rosterLastName = lastNameOnly(rosterKey);
    const unclaimed: { key: string; yearMap: Map<number, BattingStats> }[] = [];
    for (const [statsKey, yearMap] of statsLookup) {
      if (
        !claimedStatsKeys.has(statsKey) &&
        lastNameOnly(statsKey) === rosterLastName
      ) {
        unclaimed.push({ key: statsKey, yearMap });
      }
    }
    if (unclaimed.length === 1) {
      matchResults.set(rp, unclaimed[0].yearMap);
      claimedStatsKeys.add(unclaimed[0].key);
    }
  }

  const players: PlayerOutput[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const { rp } of rosterWithKeys) {
    const playerStats = matchResults.get(rp);

    if (!playerStats || playerStats.size === 0) {
      unmatched++;
      continue;
    }
    matched++;

    // Build season entries
    const seasons: SeasonStats[] = [];
    const careerTotals = {
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

    for (const year of years) {
      const s = playerStats.get(year);
      if (!s) continue;

      const pa = s.ab + s.bb + s.sf + s.sh + s.hbp;
      const woba = calculateWoba(s);

      seasons.push({
        year,
        name: s.name,
        avg: s.avg,
        ops: s.ops,
        gp: s.gp,
        gs: s.gs,
        ab: s.ab,
        r: s.r,
        h: s.h,
        doubles: s.doubles,
        triples: s.triples,
        hr: s.hr,
        rbi: s.rbi,
        tb: s.tb,
        slg: s.slg,
        bb: s.bb,
        hbp: s.hbp,
        so: s.so,
        gdp: s.gdp,
        obp: s.obp,
        sf: s.sf,
        sh: s.sh,
        sb: s.sb,
        sbAtt: s.sbAtt,
        woba: Math.round(woba * 1000) / 1000,
        pa,
      });

      careerTotals.gp += s.gp;
      careerTotals.gs += s.gs;
      careerTotals.ab += s.ab;
      careerTotals.r += s.r;
      careerTotals.h += s.h;
      careerTotals.doubles += s.doubles;
      careerTotals.triples += s.triples;
      careerTotals.hr += s.hr;
      careerTotals.rbi += s.rbi;
      careerTotals.tb += s.tb;
      careerTotals.bb += s.bb;
      careerTotals.hbp += s.hbp;
      careerTotals.so += s.so;
      careerTotals.gdp += s.gdp;
      careerTotals.sf += s.sf;
      careerTotals.sh += s.sh;
      careerTotals.sb += s.sb;
      careerTotals.sbAtt += s.sbAtt;
    }

    if (seasons.length === 0) continue;

    const careerPa =
      careerTotals.ab +
      careerTotals.bb +
      careerTotals.sf +
      careerTotals.sh +
      careerTotals.hbp;
    const careerWoba = calculateWoba(careerTotals);

    // Compute career rate stats from totals
    const careerAvg =
      careerTotals.ab > 0
        ? Math.round((careerTotals.h / careerTotals.ab) * 1000) / 1000
        : 0;
    const careerSlg =
      careerTotals.ab > 0
        ? Math.round((careerTotals.tb / careerTotals.ab) * 1000) / 1000
        : 0;
    const careerObp =
      careerPa > 0
        ? Math.round(
            ((careerTotals.h + careerTotals.bb + careerTotals.hbp) /
              (careerTotals.ab +
                careerTotals.bb +
                careerTotals.hbp +
                careerTotals.sf)) *
              1000
          ) / 1000
        : 0;
    const careerOps = Math.round((careerSlg + careerObp) * 1000) / 1000;

    players.push({
      name: rp.name,
      jerseyNumber: rp.jerseyNumber,
      classYear: rp.classYear,
      seasons,
      career: {
        ...careerTotals,
        avg: careerAvg,
        ops: careerOps,
        slg: careerSlg,
        obp: careerObp,
        woba: Math.round(careerWoba * 1000) / 1000,
        pa: careerPa,
      },
    });
  }

  // Sort by career wOBA descending
  players.sort((a, b) => b.career.woba - a.career.woba);

  console.log(
    `  Matched: ${matched}, Unmatched roster players (no stats): ${unmatched}`
  );

  return {
    slug,
    domain,
    scrapedAt: new Date().toISOString(),
    players,
  };
}

// ── Main ──

async function main(): Promise<void> {
  const teamFilter = parseTeamArg();
  const years = parseYearsArg();
  const outputDir = path.resolve(__dirname, '../public/data/opponents');
  fs.mkdirSync(outputDir, { recursive: true });

  const teamsToScrape = teamFilter
    ? { [teamFilter]: TEAMS[teamFilter] }
    : TEAMS;

  if (teamFilter && !TEAMS[teamFilter]) {
    console.error(
      `Unknown team slug: "${teamFilter}". Available: ${Object.keys(TEAMS).join(', ')}`
    );
    process.exit(1);
  }

  console.log(`Scraping opponents for years: ${years.join(', ')}`);
  console.log(`Teams: ${Object.keys(teamsToScrape).join(', ')}`);
  console.log(`Output directory: ${outputDir}`);

  for (const [slug, domain] of Object.entries(teamsToScrape)) {
    const result = await scrapeTeam(slug, domain, years);

    const outPath = path.join(outputDir, `${slug}-historical-stats.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`  Wrote ${outPath} (${result.players.length} players)`);

    // Be nice between teams
    if (Object.keys(teamsToScrape).length > 1) {
      await delay(1000);
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
