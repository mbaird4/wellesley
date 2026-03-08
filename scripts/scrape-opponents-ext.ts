/**
 * Generic scraper for non-Sidearm opponent sites.
 * Uses a required `--site` argument to select the parsing strategy.
 * Currently only `--site presto` is implemented.
 *
 * Outputs identical JSON format to scrape-opponents.ts so downstream
 * Angular code needs zero changes.
 *
 * Usage:
 *   npm run scrape-ext -- --site presto --years 2026,2025 --with-pitching --with-gamedata
 *   npm run scrape-ext -- --site presto --team framingham --years 2026
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Types (same as scrape-opponents.ts) ──

type BatHand = 'L' | 'R' | 'S';

interface RosterPlayer {
  name: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  throws: 'L' | 'R' | null;
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

interface PitchingStatsRow {
  name: string;
  w: number;
  l: number;
  era: number;
  app: number;
  gs: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
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
  position: string | null;
  bats: BatHand | null;
  seasons: SeasonStats[];
  career: CareerStats;
}

interface TeamOutput {
  slug: string;
  domain: string;
  scrapedAt: string;
  players: PlayerOutput[];
  teamGamesByYear: Record<string, number>;
}

interface GamedataPlayByPlayInning {
  inning: string;
  half: 'offense' | 'defense';
  plays: string[];
}

interface GamedataSerializedGame {
  year: number;
  url: string;
  opponent: string;
  pitchers: string[];
  lineup: [number, string[]][];
  playByPlay: GamedataPlayByPlayInning[];
}

interface GamePitchingData {
  year: number;
  url: string;
  date: string;
  opponent: string;
  pitchers: string[];
  battingInnings: { inning: string; plays: string[] }[];
}

interface TeamConfig {
  domain: string;
  teamSlug: string;
}

// ── Constants ──

const DELAY_MS = 500;
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEARS = [2026, 2025, 2024, 2023];

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

function toNormalizedKey(first: string, last: string): string {
  return normalizeName(`${last}, ${first}`);
}

function statsNameToKey(statsName: string): string {
  return normalizeName(statsName);
}

function lastNameOnly(key: string): string {
  return key.split(',')[0].trim();
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

  if (denominator === 0) {
    return 0;
  }

  const numerator =
    0.5 * stats.bb +
    0.5 * stats.hbp +
    0.9 * singles +
    1.2 * stats.doubles +
    1.7 * stats.triples +
    2.5 * stats.hr;

  return numerator / denominator;
}

function emptyCareer(): CareerStats {
  return {
    avg: 0,
    ops: 0,
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
    slg: 0,
    bb: 0,
    hbp: 0,
    so: 0,
    gdp: 0,
    obp: 0,
    sf: 0,
    sh: 0,
    sb: 0,
    sbAtt: 0,
    woba: 0,
    pa: 0,
  };
}

// ── CLI arg parsing ──

function parseSiteArg(): string | null {
  const idx = process.argv.indexOf('--site');

  if (idx === -1 || idx + 1 >= process.argv.length) {
    return null;
  }

  return process.argv[idx + 1].trim().toLowerCase();
}

function parseTeamArg(): string | null {
  const idx = process.argv.indexOf('--team');

  if (idx === -1 || idx + 1 >= process.argv.length) {
    return null;
  }

  return process.argv[idx + 1].trim().toLowerCase();
}

function parseYearsArg(): number[] {
  const idx = process.argv.indexOf('--years');

  if (idx === -1 || idx + 1 >= process.argv.length) {
    return DEFAULT_YEARS;
  }

  return process.argv[idx + 1]
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

function parseWithPitchingFlag(): boolean {
  return process.argv.includes('--with-pitching');
}

function parseWithGamedataFlag(): boolean {
  return process.argv.includes('--with-gamedata');
}

function gamedataFilename(year: number): string {
  return year === CURRENT_YEAR ? 'gamedata.json' : `gamedata-${year}.json`;
}

function battingFilename(year: number): string {
  return year === CURRENT_YEAR
    ? 'batting-stats.json'
    : `batting-stats-${year}.json`;
}

function pitchingFilename(year: number): string {
  return year === CURRENT_YEAR ? 'pitching.json' : `pitching-${year}.json`;
}

// ── Presto Sports specifics ──

const PRESTO_TEAMS: Record<string, TeamConfig> = {
  framingham: { domain: 'www.fsurams.com', teamSlug: 'framinghamst' },
  salemstate: { domain: 'salemstatevikings.com', teamSlug: 'salemst' },
};

const PRESTO_ALIASES: Record<string, string[]> = {
  framingham: ['Framingham State', 'Framingham St', 'Framingham'],
  salemstate: ['Salem State', 'Salem St', 'Salem'],
};

/** Convert year (e.g. 2026) to Presto Sports format (e.g. "2025-26") */
function prestoYearFormat(year: number): string {
  return `${year - 1}-${String(year).slice(2)}`;
}

function buildPrestoScheduleUrl(domain: string, season: string): string {
  return `https://${domain}/sports/sball/${season}/schedule`;
}

function buildPrestoRosterUrl(domain: string, season: string): string {
  return `https://${domain}/sports/sball/${season}/roster`;
}

function buildPrestoStatsUrl(
  domain: string,
  season: string,
  teamSlug: string
): string {
  return `https://${domain}/sports/sball/${season}/teams/${teamSlug}?view=lineup`;
}

function buildPrestoPitchingStatsUrl(
  domain: string,
  season: string,
  teamSlug: string
): string {
  return `https://${domain}/sports/sball/${season}/teams/${teamSlug}?view=pitching`;
}

// ── Presto roster parsing ──

function parsePrestoRoster($: cheerio.CheerioAPI): RosterPlayer[] {
  const players: RosterPlayer[] = [];

  // Presto rosters use standard table rows with columns: No., Name, Pos., Cl., B/T
  $('table').each((_, table) => {
    const $table = $(table);
    const headers: string[] = [];

    $table.find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    // Check if this looks like a roster table
    const hasNo = headers.some((h) => h === 'no.' || h === '#' || h === 'no');
    const hasName = headers.some(
      (h) => h === 'name' || h === 'player' || h === 'full name'
    );

    if (!hasNo && !hasName) {
      return;
    }

    const noIdx = headers.findIndex(
      (h) => h === 'no.' || h === '#' || h === 'no'
    );
    const nameIdx = headers.findIndex(
      (h) => h === 'name' || h === 'player' || h === 'full name'
    );
    const posIdx = headers.findIndex(
      (h) => h === 'pos.' || h === 'pos' || h === 'position'
    );
    const clIdx = headers.findIndex(
      (h) =>
        h === 'cl.' || h === 'cl' || h === 'yr.' || h === 'yr' || h === 'class'
    );
    const btIdx = headers.findIndex(
      (h) => h === 'b/t' || h === 'b-t' || h === 'bat/thr'
    );

    $table.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');

      if (cells.length < 2) {
        return;
      }

      const jerseyText = noIdx >= 0 ? $(cells[noIdx]).text().trim() : '';
      const jerseyNumber = jerseyText ? parseInt(jerseyText, 10) : null;

      const fullName =
        nameIdx >= 0
          ? $(cells[nameIdx]).find('a').text().trim() ||
            $(cells[nameIdx]).text().trim()
          : '';

      if (!fullName) {
        return;
      }

      // Presto names are typically "First Last" or "Last, First"
      let firstName = '';
      let lastName = '';

      if (fullName.includes(',')) {
        const parts = fullName.split(',');
        lastName = parts[0].trim();
        firstName = (parts[1] || '').trim();
      } else {
        const parts = fullName.split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      const position =
        posIdx >= 0 ? $(cells[posIdx]).text().trim() || null : null;
      const classYear = clIdx >= 0 ? $(cells[clIdx]).text().trim() : '';

      let bats: BatHand | null = null;
      let throws: 'L' | 'R' | null = null;

      if (btIdx >= 0) {
        const btText = $(cells[btIdx]).text().trim();

        if (btText && /[LRS]\s*[\/\-]\s*[LR]/i.test(btText)) {
          const btParts = btText.split(/[\/\-]/);
          const batChar = btParts[0]?.trim().toUpperCase();

          if (batChar === 'L' || batChar === 'R' || batChar === 'S') {
            bats = batChar;
          }

          const throwChar = btParts[1]?.trim().toUpperCase();

          if (throwChar === 'L' || throwChar === 'R') {
            throws = throwChar;
          }
        }
      }

      const name = `${firstName} ${lastName}`.trim();
      players.push({
        name,
        firstName,
        lastName,
        jerseyNumber:
          jerseyNumber !== null && !isNaN(jerseyNumber) ? jerseyNumber : null,
        classYear,
        position,
        bats,
        throws,
      });
    });

    if (players.length > 0) {
      return false; // stop after first matching table
    }
  });

  return players;
}

// ── Presto batting stats parsing ──

function parsePrestoStatsTable($: cheerio.CheerioAPI): BattingStats[] {
  const players: BattingStats[] = [];

  $('table').each((_, table) => {
    const $table = $(table);
    const headers: string[] = [];

    $table.find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    // Look for table with batting-like columns (AB, H, AVG, etc.)
    const hasAb = headers.some((h) => h === 'ab');
    const hasH = headers.some((h) => h === 'h');

    if (!hasAb || !hasH) {
      return;
    }

    const col = (label: string): number =>
      headers.findIndex((h) => h === label.toLowerCase());

    const nameCol = col('name') >= 0 ? col('name') : col('player');
    const gpCol = col('gp');
    const gsCol = col('gs');
    const abCol = col('ab');
    const rCol = col('r');
    const hCol = col('h');
    const doublesCol = col('2b');
    const triplesCol = col('3b');
    const hrCol = col('hr');
    const rbiCol = col('rbi');
    const tbCol = col('tb');
    const bbCol = col('bb');
    const hbpCol = col('hbp');
    const soCol = col('k') >= 0 ? col('k') : col('so'); // Presto uses "K"
    const gdpCol = col('gdp') >= 0 ? col('gdp') : col('gidp');
    const sfCol = col('sf');
    const shCol = col('sh') >= 0 ? col('sh') : col('sac');
    const sbCol = col('sb');
    const sbAttCol = col('sb-att') >= 0 ? col('sb-att') : col('att');
    const avgCol = col('avg') >= 0 ? col('avg') : col('ba');
    const obpCol = col('obp') >= 0 ? col('obp') : col('ob%');
    const slgCol = col('slg') >= 0 ? col('slg') : col('slg%');
    const opsCol = col('ops');

    $table.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');

      if (cells.length < 3) {
        return;
      }

      const rawName =
        nameCol >= 0
          ? $(cells[nameCol]).find('a').text().trim() ||
            $(cells[nameCol]).text().trim()
          : '';

      if (
        !rawName ||
        rawName.toLowerCase() === 'totals' ||
        rawName.toLowerCase() === 'total' ||
        rawName.toLowerCase() === 'opponents'
      ) {
        return;
      }

      // Convert "First Last" to "Last, First" for stats name format
      let name = rawName;

      if (!rawName.includes(',')) {
        const parts = rawName.split(/\s+/);

        if (parts.length >= 2) {
          name = `${parts.slice(1).join(' ')}, ${parts[0]}`;
        }
      }

      const num = (idx: number): number => {
        if (idx < 0 || idx >= cells.length) {
          return 0;
        }

        return parseInt($(cells[idx]).text().trim(), 10) || 0;
      };

      const pct = (idx: number): number => {
        if (idx < 0 || idx >= cells.length) {
          return 0;
        }

        return parseFloat($(cells[idx]).text().trim()) || 0;
      };

      const ab = num(abCol);
      const h = num(hCol);
      const doubles = num(doublesCol);
      const triples = num(triplesCol);
      const hr = num(hrCol);
      const bb = num(bbCol);
      const hbp = num(hbpCol);
      const sf = num(sfCol);
      const sh = num(shCol);
      const tb = tbCol >= 0 ? num(tbCol) : h + doubles + 2 * triples + 3 * hr;
      const avg = avgCol >= 0 ? pct(avgCol) : ab > 0 ? h / ab : 0;
      const slg = slgCol >= 0 ? pct(slgCol) : ab > 0 ? tb / ab : 0;
      const pa = ab + bb + sf + sh + hbp;
      const obp = obpCol >= 0 ? pct(obpCol) : pa > 0 ? (h + bb + hbp) / pa : 0;
      const ops = opsCol >= 0 ? pct(opsCol) : slg + obp;

      // Handle SB - may be a single column or sb-att format
      let sb = 0;
      let sbAtt = 0;

      if (sbCol >= 0) {
        const sbText = $(cells[sbCol]).text().trim();
        const sbMatch = sbText.match(/^(\d+)-(\d+)$/);

        if (sbMatch) {
          sb = parseInt(sbMatch[1], 10);
          sbAtt = parseInt(sbMatch[2], 10);
        } else {
          sb = parseInt(sbText, 10) || 0;
          sbAtt = sbAttCol >= 0 ? num(sbAttCol) : sb;
        }
      }

      // Handle GP/GS
      let gp = num(gpCol);
      let gs = gsCol >= 0 ? num(gsCol) : 0;

      // Some Presto sites combine "GP-GS"
      if (gpCol >= 0) {
        const gpText = $(cells[gpCol]).text().trim();
        const gpGsMatch = gpText.match(/^(\d+)-(\d+)$/);

        if (gpGsMatch) {
          gp = parseInt(gpGsMatch[1], 10);
          gs = parseInt(gpGsMatch[2], 10);
        }
      }

      players.push({
        name,
        avg: Math.round(avg * 1000) / 1000,
        ops: Math.round(ops * 1000) / 1000,
        gp,
        gs,
        ab,
        r: num(rCol),
        h,
        doubles,
        triples,
        hr,
        rbi: num(rbiCol),
        tb,
        slg: Math.round(slg * 1000) / 1000,
        bb,
        hbp,
        so: num(soCol),
        gdp: num(gdpCol),
        obp: Math.round(obp * 1000) / 1000,
        sf,
        sh,
        sb,
        sbAtt,
      });
    });

    if (players.length > 0) {
      return false; // stop after first matching table
    }
  });

  return players;
}

// ── Presto pitching stats parsing ──

function parsePrestoPitchingStatsTable(
  $: cheerio.CheerioAPI
): PitchingStatsRow[] {
  const pitchers: PitchingStatsRow[] = [];

  $('table').each((_, table) => {
    const $table = $(table);
    const headers: string[] = [];

    $table.find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    // Look for pitching-like columns (IP, ERA, etc.)
    const hasIp = headers.some((h) => h === 'ip');
    const hasEra = headers.some((h) => h === 'era');

    if (!hasIp || !hasEra) {
      return;
    }

    const col = (label: string): number =>
      headers.findIndex((h) => h === label.toLowerCase());

    const nameCol = col('name') >= 0 ? col('name') : col('player');
    const wCol = col('w');
    const lCol = col('l');
    const eraCol = col('era');
    const appCol = col('app') >= 0 ? col('app') : col('g');
    const gsCol = col('gs');
    const ipCol = col('ip');
    const hitsCol = col('h');
    const rCol = col('r');
    const erCol = col('er');
    const bbCol = col('bb');
    const soCol = col('k') >= 0 ? col('k') : col('so');
    const hrCol = col('hr');

    $table.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');

      if (cells.length < 3) {
        return;
      }

      const rawName =
        nameCol >= 0
          ? $(cells[nameCol]).find('a').text().trim() ||
            $(cells[nameCol]).text().trim()
          : '';

      if (
        !rawName ||
        rawName.toLowerCase() === 'totals' ||
        rawName.toLowerCase() === 'total' ||
        rawName.toLowerCase() === 'opponents'
      ) {
        return;
      }

      let name = rawName;

      if (!rawName.includes(',')) {
        const parts = rawName.split(/\s+/);

        if (parts.length >= 2) {
          name = `${parts.slice(1).join(' ')}, ${parts[0]}`;
        }
      }

      const num = (idx: number): number => {
        if (idx < 0 || idx >= cells.length) {
          return 0;
        }

        return parseInt($(cells[idx]).text().trim(), 10) || 0;
      };

      const pct = (idx: number): number => {
        if (idx < 0 || idx >= cells.length) {
          return 0;
        }

        return parseFloat($(cells[idx]).text().trim()) || 0;
      };

      // Handle W-L which may be combined in one column
      let w = num(wCol);
      let l = num(lCol);

      if (wCol >= 0 && lCol < 0) {
        const wlText = $(cells[wCol]).text().trim();
        const wlMatch = wlText.match(/^(\d+)-(\d+)$/);

        if (wlMatch) {
          w = parseInt(wlMatch[1], 10);
          l = parseInt(wlMatch[2], 10);
        }
      }

      // Handle APP-GS combined column
      let app = num(appCol);
      let gs = gsCol >= 0 ? num(gsCol) : 0;

      if (appCol >= 0) {
        const appText = $(cells[appCol]).text().trim();
        const appGsMatch = appText.match(/^(\d+)-(\d+)$/);

        if (appGsMatch) {
          app = parseInt(appGsMatch[1], 10);
          gs = parseInt(appGsMatch[2], 10);
        }
      }

      const ipText = ipCol >= 0 ? $(cells[ipCol]).text().trim() : '0';
      const ip = parseFloat(ipText) || 0;

      pitchers.push({
        name,
        w,
        l,
        era: pct(eraCol),
        app,
        gs,
        ip,
        h: num(hitsCol),
        r: num(rCol),
        er: num(erCol),
        bb: num(bbCol),
        so: num(soCol),
        hr: num(hrCol),
      });
    });

    if (pitchers.length > 0) {
      return false; // stop after first matching table
    }
  });

  return pitchers;
}

// ── Presto team GP extraction ──

function parsePrestoTeamGames($: cheerio.CheerioAPI): number | null {
  let teamGp: number | null = null;

  $('table').each((_, table) => {
    const $table = $(table);
    const headers: string[] = [];

    $table.find('thead th, thead td').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    const hasAb = headers.some((h) => h === 'ab');
    const hasGp = headers.some((h) => h === 'gp');

    if (!hasAb || !hasGp) {
      return;
    }

    const gpCol = headers.findIndex((h) => h === 'gp');

    $table.find('tbody tr, tfoot tr').each((_, row) => {
      const cells = $(row).find('td, th');
      const nameCol = headers.findIndex((h) => h === 'name' || h === 'player');
      const nameText =
        nameCol >= 0
          ? $(cells[nameCol]).text().trim().toLowerCase()
          : $(cells[0]).text().trim().toLowerCase();

      if (nameText === 'totals' || nameText === 'total') {
        const gpText = gpCol >= 0 ? $(cells[gpCol]).text().trim() : '';
        const gpMatch = gpText.match(/^(\d+)/);
        teamGp = gpMatch ? parseInt(gpMatch[1], 10) : null;

        return false;
      }
    });

    if (teamGp !== null) {
      return false;
    }
  });

  return teamGp;
}

// ── Presto boxscore URL extraction ──

function extractPrestoBoxscoreUrls(
  $: cheerio.CheerioAPI,
  domain: string
): string[] {
  const baseUrl = `https://${domain}`;
  const urls: string[] = [];

  // Presto uses links with .xml extension (despite serving HTML)
  let links = $('a[href*=".xml"]');

  // Also try generic boxscore links
  if (links.length === 0) {
    links = $('a[href*="boxscore"]');
  }

  // Also try links containing the sports/sball path with game IDs
  if (links.length === 0) {
    links = $('a[href*="/sports/sball/"]').filter((_, el) => {
      const href = $(el).attr('href') || '';

      return href.includes('boxscore') || href.endsWith('.xml');
    });
  }

  links.each((_, element) => {
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    const fullUrl = href.startsWith('http')
      ? href
      : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    urls.push(fullUrl);
  });

  return [...new Set(urls)];
}

// ── Presto play-by-play parsing ──

interface PbPInning {
  inning: string;
  teamName: string;
  plays: string[];
}

function captionMatchesTeam(text: string, teamAliases: string[]): boolean {
  const lower = text.toLowerCase();

  return teamAliases.some((alias) => lower.includes(alias.toLowerCase()));
}

function parsePrestoPlayByPlay($: cheerio.CheerioAPI): PbPInning[] {
  const innings: PbPInning[] = [];
  const seen = new Set<string>();

  // Presto uses <h3> headings like "Team Top of 1st Inning" or "Team Bottom of 2nd Inning"
  // followed by play text in various formats (tables, divs, or paragraph elements)
  $('h3, h4').each((_, heading) => {
    const text = $(heading).text().trim();
    const match = text.match(
      /^(.+?)\s+(Top|Bottom)\s+of\s+(\d+(?:st|nd|rd|th))\s+Inning/i
    );

    if (!match) {
      return;
    }

    const teamName = match[1].trim();
    const inning = match[3];
    const dedupeKey = `${teamName}::${inning}`;

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);

    const plays: string[] = [];

    // Look at sibling elements until we hit another heading or section break
    let $next = $(heading).next();

    while ($next.length > 0) {
      const tag = $next.prop('tagName')?.toLowerCase() || '';

      // Stop at next heading or horizontal rule
      if (['h3', 'h4', 'h2', 'hr'].includes(tag)) {
        break;
      }

      if (tag === 'table') {
        // PBP may be in a table
        $next.find('tr').each((_, row) => {
          const rowText = $(row).text().trim();

          if (
            rowText &&
            rowText.length >= 5 &&
            !rowText.toLowerCase().includes('inning summary') &&
            !rowText.toLowerCase().includes('play description')
          ) {
            plays.push(rowText);
          }
        });
      } else {
        // PBP may be in div/p elements
        const playText = $next.text().trim();

        if (
          playText &&
          playText.length >= 5 &&
          !playText.toLowerCase().includes('inning summary')
        ) {
          // Split on newlines in case multiple plays are in one element
          playText.split('\n').forEach((line) => {
            const trimmed = line.trim();

            if (trimmed.length >= 5) {
              plays.push(trimmed);
            }
          });
        }
      }

      $next = $next.next();
    }

    if (plays.length > 0) {
      innings.push({ inning, teamName, plays });
    }
  });

  // Fallback: try Sidearm-style table captions in #play-by-play
  if (innings.length === 0) {
    const pbpTab = $('#play-by-play');

    if (pbpTab.length > 0) {
      pbpTab.find('table').each((_, table) => {
        const $table = $(table);
        const caption = $table.find('caption').text() || '';

        if (!caption) {
          return;
        }

        const teamName = caption
          .replace(/\s*-\s*(Top|Bottom)\s+of\s+.*/i, '')
          .trim();
        const inningMatch = caption.match(/(?:Top|Bottom)\s+of\s+(.+)/i);
        const inning = inningMatch ? inningMatch[1].trim() : '';

        if (!inning) {
          return;
        }

        const dedupeKey = `${teamName}::${inning}`;

        if (seen.has(dedupeKey)) {
          return;
        }

        seen.add(dedupeKey);

        const plays: string[] = [];

        $table.find('tbody tr').each((_, row) => {
          const $row = $(row);
          const firstCell = $row.find('td').first();
          const originalText =
            (firstCell.length ? firstCell.text() : $row.text()).trim() || '';
          const lowerText = originalText.toLowerCase();

          if (
            !originalText ||
            lowerText.includes('play description') ||
            originalText.length < 5 ||
            lowerText.includes('inning summary') ||
            lowerText.match(/^\d+(st|nd|rd|th)\s+inning/i)
          ) {
            return;
          }

          plays.push(originalText);
        });

        if (plays.length > 0) {
          innings.push({ inning, teamName, plays });
        }
      });
    }
  }

  return innings;
}

// ── Presto lineup parsing ──

function parsePrestoLineup(
  $: cheerio.CheerioAPI,
  teamAliases: string[]
): [number, string[]][] {
  const lineup = new Map<number, string[]>();

  // Try to find batting lineup tables — look for tables with "batting" context
  // that match the team name
  $('table').each((_, table) => {
    const $table = $(table);

    // Check caption or preceding heading for team name
    const caption = $table.find('caption').text() || '';
    const prevHeading =
      $table.prev('h3, h4, h2').text() ||
      $table.parent().find('h3, h4').first().text() ||
      '';
    const context = `${caption} ${prevHeading}`;

    if (!captionMatchesTeam(context, teamAliases)) {
      return;
    }

    // Skip pitching tables
    const lower = context.toLowerCase();

    if (
      lower.includes('pitching') ||
      lower.includes('top of') ||
      lower.includes('bottom of')
    ) {
      return;
    }

    let slot = 1;

    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 2) {
        return;
      }

      // Try to find player name — look for a link or the name cell
      let playerText = '';

      cells.each((_, cell) => {
        const link = $(cell).find('a').first();

        if (link.length > 0 && link.text().trim()) {
          playerText = link.text().trim();

          return false;
        }
      });

      if (!playerText) {
        // Fallback: use second cell text
        playerText = $(cells[1]).text().trim();
      }

      // Strip position prefix (e.g. "cf Emily Smith")
      const nameMatch = playerText.match(/^[a-z/]+ (.+)$/i);
      const playerName = nameMatch ? nameMatch[1].trim() : playerText.trim();

      if (!playerName) {
        return;
      }

      const normalized = normalizeName(playerName);

      // Check for substitution — indentation or different visual indicator
      const cellHtml = $(cells[1]).html() || '';
      const rawText = $(cells[1]).text() || '';
      const isSubstitution =
        cellHtml.startsWith('&nbsp;&nbsp;&nbsp;&nbsp;') ||
        /^(&nbsp;){4,}/.test(cellHtml) ||
        /^(\u00A0|\s){4,}/.test(rawText);

      if (isSubstitution) {
        const previousSlot = slot - 1;

        if (previousSlot > 0) {
          const existingNames = lineup.get(previousSlot) || [];
          existingNames.push(normalized);
          lineup.set(previousSlot, existingNames);
        }
      } else {
        lineup.set(slot, [normalized]);
        slot += 1;
      }
    });

    if (lineup.size > 0) {
      return false; // stop after first matching table
    }
  });

  return Array.from(lineup.entries());
}

// ── Presto pitchers parsing ──

function parsePrestoPitchers(
  $: cheerio.CheerioAPI,
  teamAliases: string[]
): string[] {
  const pitchers: string[] = [];

  $('table').each((_, table) => {
    const caption = $(table).find('caption').text() || '';
    const prevHeading = $(table).prev('h3, h4, h2').text() || '';
    const context = `${caption} ${prevHeading}`;

    if (!context.toLowerCase().includes('pitching')) {
      return;
    }

    if (!captionMatchesTeam(context, teamAliases)) {
      return;
    }

    $(table)
      .find('tbody tr')
      .each((_, row) => {
        const link = $(row).find('a').first();
        const name =
          link.text().trim() || $(row).find('td').first().text().trim();

        if (name && name.toLowerCase() !== 'totals') {
          pitchers.push(name);
        }
      });

    return false; // stop after first matching pitching table
  });

  return pitchers;
}

// ── Presto game date extraction ──

function parsePrestoGameDate($: cheerio.CheerioAPI, url: string): string {
  // Try various selectors
  let date = '';

  // Presto often has date in page title or specific elements
  const title = $('title').text();
  const dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);

  if (dateMatch) {
    date = dateMatch[1];
  }

  if (!date) {
    // Try finding a date element
    $('dt, .game-date, .date').each((_, el) => {
      const text = $(el).text().trim();

      if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) {
        date = text;

        return false;
      }
    });
  }

  return date;
}

// ── Presto opponent name from URL ──

function parseOpponentFromUrl(url: string): string {
  // Try multiple URL patterns
  const patterns = [
    /\/(\d{4})\-\d{2}\/([^/]+)\//, // Presto format
    /stats\/\d{4}\/([^/]+)\//,
    /boxscore.*?vs[._-]?([^/._]+)/i,
  ];

  return patterns.reduce((result, pattern) => {
    if (result !== 'Unknown') {
      return result;
    }

    const match = url.match(pattern);
    const slug = match ? match[match.length - 1] : null;

    if (slug) {
      return slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return result;
  }, 'Unknown');
}

// ── Per-team scraping ──

async function scrapeTeam(
  slug: string,
  config: TeamConfig,
  years: number[],
  aliases: string[]
): Promise<TeamOutput> {
  console.log(`\n=== ${slug} (${config.domain}) ===`);

  // 1. Fetch roster from most recent year
  const latestSeason = prestoYearFormat(years[0] || CURRENT_YEAR);
  console.log('  Fetching roster...');
  const rosterUrl = buildPrestoRosterUrl(config.domain, latestSeason);
  const rosterHtml = await fetchPage(rosterUrl);
  const roster = rosterHtml ? parsePrestoRoster(cheerio.load(rosterHtml)) : [];
  console.log(`  Found ${roster.length} roster players`);

  // 2. Fetch stats for each year
  const statsByYear = new Map<number, BattingStats[]>();
  const teamGpByYear = new Map<number, number>();

  for (const year of years) {
    await delay(DELAY_MS);
    const season = prestoYearFormat(year);
    console.log(`  Fetching ${year} (${season}) stats...`);
    const statsUrl = buildPrestoStatsUrl(
      config.domain,
      season,
      config.teamSlug
    );
    const statsHtml = await fetchPage(statsUrl);

    if (statsHtml) {
      const $stats = cheerio.load(statsHtml);
      const stats = parsePrestoStatsTable($stats);
      statsByYear.set(year, stats);
      console.log(`    Parsed ${stats.length} players`);

      const teamGp = parsePrestoTeamGames($stats);

      if (teamGp !== null) {
        teamGpByYear.set(year, teamGp);
        console.log(`    Team GP: ${teamGp}`);
      } else {
        const maxGp = Math.max(...stats.map((s) => s.gp), 0);

        if (maxGp > 0) {
          teamGpByYear.set(year, maxGp);
          console.log(`    Team GP (fallback from max player GP): ${maxGp}`);
        }
      }
    } else {
      console.log(`    No stats page for ${year}`);
    }
  }

  // 3. Build stats lookup: normalizedKey → { year → BattingStats }
  const statsLookup = new Map<string, Map<number, BattingStats>>();

  statsByYear.forEach((stats, year) => {
    stats.forEach((s) => {
      const key = statsNameToKey(s.name);

      if (!statsLookup.has(key)) {
        statsLookup.set(key, new Map());
      }

      statsLookup.get(key)!.set(year, s);
    });
  });

  // 4. Match roster players to stats
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

  rosterWithKeys.forEach(({ rp, rosterKey }) => {
    const exact = statsLookup.get(rosterKey);

    if (exact) {
      matchResults.set(rp, exact);
      claimedStatsKeys.add(rosterKey);
    }
  });

  // Pass 2: surname fallback
  rosterWithKeys.forEach(({ rp, rosterKey }) => {
    if (matchResults.has(rp)) {
      return;
    }

    const rosterLastName = lastNameOnly(rosterKey);
    const unclaimed: { key: string; yearMap: Map<number, BattingStats> }[] = [];

    statsLookup.forEach((yearMap, statsKey) => {
      if (
        !claimedStatsKeys.has(statsKey) &&
        lastNameOnly(statsKey) === rosterLastName
      ) {
        unclaimed.push({ key: statsKey, yearMap });
      }
    });

    if (unclaimed.length === 1) {
      matchResults.set(rp, unclaimed[0].yearMap);
      claimedStatsKeys.add(unclaimed[0].key);
    }
  });

  const players: PlayerOutput[] = [];
  let matched = 0;
  let unmatched = 0;

  rosterWithKeys.forEach(({ rp }) => {
    const playerStats = matchResults.get(rp);

    if (!playerStats || playerStats.size === 0) {
      unmatched++;
      players.push({
        name: rp.name,
        jerseyNumber: rp.jerseyNumber,
        classYear: rp.classYear,
        position: rp.position,
        bats: rp.bats,
        seasons: [],
        career: emptyCareer(),
      });

      return;
    }

    matched++;
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

    years.forEach((year) => {
      const s = playerStats.get(year);

      if (!s) {
        return;
      }

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
    });

    if (seasons.length === 0) {
      players.push({
        name: rp.name,
        jerseyNumber: rp.jerseyNumber,
        classYear: rp.classYear,
        position: rp.position,
        bats: rp.bats,
        seasons: [],
        career: emptyCareer(),
      });

      return;
    }

    const careerPa =
      careerTotals.ab +
      careerTotals.bb +
      careerTotals.sf +
      careerTotals.sh +
      careerTotals.hbp;
    const careerWoba = calculateWoba(careerTotals);
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
      position: rp.position,
      bats: rp.bats,
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
  });

  // Sort by career wOBA descending
  players.sort((a, b) => b.career.woba - a.career.woba);

  console.log(
    `  Matched: ${matched}, Unmatched roster players (no stats): ${unmatched}`
  );

  const teamGamesByYear: Record<string, number> = {};

  teamGpByYear.forEach((gp, year) => {
    teamGamesByYear[String(year)] = gp;
  });

  return {
    slug,
    domain: config.domain,
    scrapedAt: new Date().toISOString(),
    players,
    teamGamesByYear,
  };
}

// ── Per-team pitching scraping ──

async function scrapeTeamPitching(
  slug: string,
  config: TeamConfig,
  years: number[],
  aliases: string[]
): Promise<{
  slug: string;
  domain: string;
  scrapedAt: string;
  pitchingStatsByYear: Record<string, PitchingStatsRow[]>;
  games: GamePitchingData[];
}> {
  console.log(`\n  --- Pitching scrape for ${slug} ---`);

  const pitchingStatsByYear: Record<string, PitchingStatsRow[]> = {};
  const allGames: GamePitchingData[] = [];

  for (const year of years) {
    const season = prestoYearFormat(year);
    console.log(`  Fetching ${year} (${season}) pitching stats...`);
    await delay(DELAY_MS);
    const statsUrl = buildPrestoPitchingStatsUrl(
      config.domain,
      season,
      config.teamSlug
    );
    const statsHtml = await fetchPage(statsUrl);

    if (statsHtml) {
      const $stats = cheerio.load(statsHtml);
      const pitchingStats = parsePrestoPitchingStatsTable($stats);
      pitchingStatsByYear[String(year)] = pitchingStats;
      console.log(`    Parsed ${pitchingStats.length} pitchers`);
    }

    // Fetch schedule to get boxscore URLs
    console.log(`  Fetching ${year} (${season}) schedule...`);
    await delay(DELAY_MS);
    const scheduleUrl = buildPrestoScheduleUrl(config.domain, season);
    const scheduleHtml = await fetchPage(scheduleUrl);

    if (!scheduleHtml) {
      console.log(`    No schedule page for ${year}`);
      continue;
    }

    const $schedule = cheerio.load(scheduleHtml);
    const boxscoreUrls = extractPrestoBoxscoreUrls($schedule, config.domain);
    console.log(`    Found ${boxscoreUrls.length} boxscore URLs`);

    // Fetch each boxscore and extract pitching data
    for (let i = 0; i < boxscoreUrls.length; i++) {
      const url = boxscoreUrls[i];
      console.log(
        `    Fetching boxscore ${i + 1}/${boxscoreUrls.length}: ${url}`
      );
      await delay(DELAY_MS);

      const html = await fetchPage(url);

      if (!html) {
        continue;
      }

      const $ = cheerio.load(html);
      const allInnings = parsePrestoPlayByPlay($);

      if (allInnings.length === 0) {
        continue;
      }

      const date = parsePrestoGameDate($, url);
      const opponent = parseOpponentFromUrl(url);

      // Separate: opponent batting innings = innings where caption team does NOT match
      const opponentBattingInnings = allInnings.filter(
        (inn) => !captionMatchesTeam(inn.teamName, aliases)
      );

      const pitchers = parsePrestoPitchers($, aliases);

      const battingInnings = opponentBattingInnings.map((inn) => ({
        inning: inn.inning,
        plays: inn.plays,
      }));

      if (battingInnings.length > 0) {
        allGames.push({ year, url, date, opponent, pitchers, battingInnings });
      }
    }
  }

  console.log(
    `  Pitching scrape complete: ${allGames.length} games with play-by-play`
  );

  return {
    slug,
    domain: config.domain,
    scrapedAt: new Date().toISOString(),
    pitchingStatsByYear,
    games: allGames,
  };
}

// ── Per-team gamedata scraping ──

async function scrapeTeamGamedata(
  slug: string,
  config: TeamConfig,
  years: number[],
  aliases: string[]
): Promise<{
  slug: string;
  domain: string;
  scrapedAt: string;
  gamesByYear: Record<string, GamedataSerializedGame[]>;
}> {
  console.log(`\n  --- Gamedata scrape for ${slug} ---`);

  const gamesByYear: Record<string, GamedataSerializedGame[]> = {};

  for (const year of years) {
    const season = prestoYearFormat(year);
    console.log(`  Fetching ${year} (${season}) schedule...`);
    await delay(DELAY_MS);
    const scheduleUrl = buildPrestoScheduleUrl(config.domain, season);
    const scheduleHtml = await fetchPage(scheduleUrl);

    if (!scheduleHtml) {
      console.log(`    No schedule page for ${year}`);
      continue;
    }

    const $schedule = cheerio.load(scheduleHtml);
    const boxscoreUrls = extractPrestoBoxscoreUrls($schedule, config.domain);
    console.log(`    Found ${boxscoreUrls.length} boxscore URLs`);

    const games: GamedataSerializedGame[] = [];

    for (let i = 0; i < boxscoreUrls.length; i++) {
      const url = boxscoreUrls[i];
      console.log(
        `    Fetching boxscore ${i + 1}/${boxscoreUrls.length}: ${url}`
      );
      await delay(DELAY_MS);

      const html = await fetchPage(url);

      if (!html) {
        continue;
      }

      const $ = cheerio.load(html);
      const lineup = parsePrestoLineup($, aliases);
      const allInnings = parsePrestoPlayByPlay($);

      const playByPlay: GamedataPlayByPlayInning[] = allInnings.map((inn) => ({
        inning: inn.inning,
        half: captionMatchesTeam(inn.teamName, aliases) ? 'offense' : 'defense',
        plays: inn.plays,
      }));

      if (lineup.length === 0 && playByPlay.length === 0) {
        continue;
      }

      const opponent = parseOpponentFromUrl(url);
      const pitchers = parsePrestoPitchers($, aliases).map(normalizeName);
      games.push({ year, url, opponent, pitchers, lineup, playByPlay });
    }

    if (games.length > 0) {
      gamesByYear[String(year)] = games;
    }

    console.log(`    ${year}: ${games.length} games with gamedata`);
  }

  const totalGames = Object.values(gamesByYear).reduce(
    (sum, g) => sum + g.length,
    0
  );
  console.log(`  Gamedata scrape complete: ${totalGames} total games`);

  return {
    slug,
    domain: config.domain,
    scrapedAt: new Date().toISOString(),
    gamesByYear,
  };
}

// ── Main ──

async function main(): Promise<void> {
  const site = parseSiteArg();

  if (!site) {
    console.error('Required: --site <provider> (e.g. --site presto)');
    process.exit(1);
  }

  if (site !== 'presto') {
    console.error(`Unknown site provider: "${site}". Available: presto`);
    process.exit(1);
  }

  const teamFilter = parseTeamArg();
  const years = parseYearsArg();
  const withPitching = parseWithPitchingFlag();
  const withGamedata = parseWithGamedataFlag();
  const outputDir = path.resolve(__dirname, '../public/data/opponents/florida');
  fs.mkdirSync(outputDir, { recursive: true });

  const teams = PRESTO_TEAMS;
  const aliases = PRESTO_ALIASES;

  const teamsToScrape = teamFilter
    ? { [teamFilter]: teams[teamFilter] }
    : teams;

  if (teamFilter && !teams[teamFilter]) {
    console.error(
      `Unknown team slug: "${teamFilter}". Available: ${Object.keys(teams).join(', ')}`
    );
    process.exit(1);
  }

  console.log(`Site: ${site}`);
  console.log(`Teams: ${Object.keys(teamsToScrape).join(', ')}`);
  console.log(`Years: ${years.join(', ')}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Pitching: ${withPitching ? 'YES' : 'no'}`);
  console.log(`Gamedata: ${withGamedata ? 'YES' : 'no'}`);

  for (const [slug, config] of Object.entries(teamsToScrape)) {
    const teamAliases = aliases[slug] || [slug];
    const teamDir = path.join(outputDir, slug);
    fs.mkdirSync(teamDir, { recursive: true });

    const result = await scrapeTeam(slug, config, years, teamAliases);

    // Write roster
    const enrichedRoster: Record<
      string,
      {
        jersey: number;
        classYear: string;
        position: string | null;
        bats: BatHand | null;
        throws: 'L' | 'R' | null;
      }
    > = {};

    result.players.forEach((p) => {
      if (p.jerseyNumber !== null) {
        const key = normalizeName(
          p.name.includes(',')
            ? p.name
            : p.name.split(/\s+/).length >= 2
              ? `${p.name.split(/\s+/).slice(1).join(' ')}, ${p.name.split(/\s+/)[0]}`
              : p.name
        );
        enrichedRoster[key] = {
          jersey: p.jerseyNumber,
          classYear: p.classYear,
          position: p.position,
          bats: p.bats,
          throws: null,
        };
      }
    });

    const rosterOutPath = path.join(teamDir, 'roster.json');
    fs.writeFileSync(rosterOutPath, JSON.stringify(enrichedRoster));
    console.log(
      `  Wrote ${rosterOutPath} (${Object.keys(enrichedRoster).length} players)`
    );

    // Write per-year batting files
    const scrapedAt = result.scrapedAt;

    years.forEach((year) => {
      const yearPlayers = result.players
        .filter((p) => p.seasons.some((s) => s.year === year))
        .map((p) => ({
          name: p.name,
          jerseyNumber: p.jerseyNumber,
          classYear: p.classYear,
          position: p.position,
          bats: p.bats,
          season: p.seasons.find((s) => s.year === year)!,
        }));

      if (yearPlayers.length === 0) {
        return;
      }

      const yearData = {
        slug,
        domain: config.domain,
        scrapedAt,
        year,
        teamGames: result.teamGamesByYear[String(year)] ?? 0,
        players: yearPlayers,
      };
      const outPath = path.join(teamDir, battingFilename(year));
      fs.writeFileSync(outPath, JSON.stringify(yearData, null, 2));
      console.log(`  Wrote ${outPath} (${yearPlayers.length} players)`);
    });

    // Optionally scrape pitching
    if (withPitching) {
      const pitchingResult = await scrapeTeamPitching(
        slug,
        config,
        years,
        teamAliases
      );

      years.forEach((year) => {
        const stats = pitchingResult.pitchingStatsByYear[String(year)] ?? [];
        const games = pitchingResult.games.filter((g) => g.year === year);

        if (stats.length === 0 && games.length === 0) {
          return;
        }

        const yearData = {
          slug,
          domain: config.domain,
          scrapedAt: pitchingResult.scrapedAt,
          year,
          pitchingStats: stats,
          games,
        };
        const outPath = path.join(teamDir, pitchingFilename(year));
        fs.writeFileSync(outPath, JSON.stringify(yearData, null, 2));
        console.log(
          `  Wrote ${outPath} (${stats.length} pitchers, ${games.length} games)`
        );
      });
    }

    // Optionally scrape gamedata
    if (withGamedata) {
      const gamedataResult = await scrapeTeamGamedata(
        slug,
        config,
        years,
        teamAliases
      );

      Object.entries(gamedataResult.gamesByYear).forEach(([year, games]) => {
        const gamedataOutPath = path.join(
          teamDir,
          gamedataFilename(Number(year))
        );
        fs.writeFileSync(gamedataOutPath, JSON.stringify(games, null, 2));
        console.log(`  Wrote ${gamedataOutPath} (${games.length} games)`);
      });
    }

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
