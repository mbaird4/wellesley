/**
 * Pre-fetch script: fetches boxscore data directly from wellesleyblue.com
 * (no CORS proxy needed in Node.js) and writes static JSON to public/data/.
 *
 * Current-year files use unsuffixed names (gamedata.json, batting-stats.json);
 * historical files keep year suffixes (gamedata-2025.json, etc.).
 *
 * Usage:
 *   npm run prefetch                          # all years
 *   npm run prefetch -- --years 2025          # single year
 *   npm run prefetch -- --years 2025,2024     # multiple years
 *   npm run prefetch -- --roster-only         # scrape roster only
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Types (mirroring batting-types.ts, avoiding Angular imports) ──

interface PlayByPlayInning {
  inning: string;
  plays: string[];
}

interface SerializedGameData {
  url: string;
  opponent: string;
  lineup: [number, string[]][];
  playByPlay: PlayByPlayInning[];
}

interface PitchingStatsRow {
  name: string;
  w: number;
  l: number;
  era: number;
  app: number;
  gs: number;
  cg: number;
  sho: number;
  sv: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  whip: number;
  doubles: number;
  triples: number;
  ab: number;
  bAvg: number;
  wp: number;
  hbp: number;
  bk: number;
  sfa: number;
  sha: number;
}

interface PbPInning {
  inning: string;
  teamName: string;
  plays: string[];
}

interface GamePitchingData {
  year: number;
  url: string;
  date: string;
  opponent: string;
  pitchers: string[];
  battingInnings: { inning: string; plays: string[] }[];
}

interface PitchingOutput {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  pitchingStats: PitchingStatsRow[];
  games: GamePitchingData[];
}

type BatHand = 'L' | 'R' | 'S';

interface RosterEntry {
  jersey: number;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  throws: 'L' | 'R' | null;
}

type Roster = Record<string, RosterEntry>;

interface SeasonStats {
  year: number;
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
  woba: number;
  pa: number;
}

interface GameBattingStats {
  name: string;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
}

interface BoxscoreData {
  date: string;
  opponent: string;
  url: string;
  playerStats: GameBattingStats[];
}

interface YearPlayer {
  name: string;
  jerseyNumber: number | null;
  classYear: string;
  position: string | null;
  bats: BatHand | null;
  season: SeasonStats;
}

interface YearBattingData {
  slug: string;
  domain: string;
  scrapedAt: string;
  year: number;
  teamGames: number;
  players: YearPlayer[];
  boxscores?: BoxscoreData[];
}

// ── wOBA calculation (mirroring stats-core/woba.ts) ──

const WOBA_WEIGHT_BB = 0.5;
const WOBA_WEIGHT_HBP = 0.5;
const WOBA_WEIGHT_1B = 0.9;
const WOBA_WEIGHT_2B = 1.2;
const WOBA_WEIGHT_3B = 1.7;
const WOBA_WEIGHT_HR = 2.5;

function calculateWoba(stats: { ab: number; h: number; doubles: number; triples: number; hr: number; bb: number; hbp: number; sf: number; sh: number }): number {
  const singles = stats.h - stats.doubles - stats.triples - stats.hr;
  const denominator = stats.ab + stats.bb + stats.sf + stats.sh + stats.hbp;

  if (denominator === 0) {
    return 0;
  }

  const numerator = WOBA_WEIGHT_BB * stats.bb + WOBA_WEIGHT_HBP * stats.hbp + WOBA_WEIGHT_1B * singles + WOBA_WEIGHT_2B * stats.doubles + WOBA_WEIGHT_3B * stats.triples + WOBA_WEIGHT_HR * stats.hr;

  return Math.round((numerator / denominator) * 1000) / 1000;
}

// ── Constants ──

const BASE_URL = 'https://wellesleyblue.com';
const DELAY_MS = 300;
const DEFAULT_YEARS = [2026, 2025, 2024, 2023, 2022, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011];

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// ── Utilities ──

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name: string): string {
  return name.replace(/\./g, '').trim().toLowerCase();
}

function extractPlayerName(cellText: string): string {
  const match = cellText.match(/^[a-z/]+ (.+)$/i);

  return match ? match[1].trim() : cellText.trim();
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'text',
      headers: HEADERS,
    });
    const html = response.data;

    if (!html || html.length < 1000) {
      console.warn(`  Skipping ${url}: response too short (${html?.length ?? 0} chars)`);

      return null;
    }

    return html;
  } catch (error: any) {
    console.warn(`  Failed to fetch ${url}: ${error.message}`);

    return null;
  }
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

function parseRosterOnlyFlag(): boolean {
  return process.argv.includes('--roster-only');
}

const CURRENT_YEAR = new Date().getFullYear();

function dataFilename(base: string, year: number): string {
  return year === CURRENT_YEAR ? `${base}.json` : `${base}-${year}.json`;
}

// ── Schedule page → boxscore URLs ──

function extractBoxscoreUrls($: cheerio.CheerioAPI): string[] {
  const urls: string[] = [];

  // Primary selector: Sidearm Sports boxscore links
  let links = $('.sidearm-schedule-game-links-boxscore a');

  // Fallback: any link containing "boxscore" in the href
  if (links.length === 0) {
    links = $('a[href*="boxscore"]');
  }

  links.each((_, element) => {
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    // Resolve to full URL
    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
    urls.push(fullUrl);
  });

  return [...new Set(urls)];
}

// ── Game data extraction (lineup + play-by-play) ──

function parseLineup($: cheerio.CheerioAPI): Map<number, string[]> {
  const lineup = new Map<number, string[]>();

  $('table').each((_, table) => {
    const $table = $(table);
    const header = $table.find('caption').text() || '';

    if (!header.includes('Wellesley')) {
      return;
    }

    let slot = 1;
    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 2) {
        return;
      }

      const $nameCell = $(cells[1]);
      const cellHtml = $nameCell.html() || '';
      const $playerLink = $nameCell.find('.boxscore_player_link');
      const playerText = $playerLink.text().trim() || '';
      const rawText = $nameCell.text() || '';

      const isSubstitution = cellHtml.startsWith('&nbsp;&nbsp;&nbsp;&nbsp;') || /^(&nbsp;){4,}/.test(cellHtml) || /^(\u00A0|\s){4,}/.test(rawText);

      const playerName = extractPlayerName(playerText);

      if (!playerName) {
        return;
      }

      const normalized = normalizeName(playerName);

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
  });

  return lineup;
}

function parsePlayByPlay($: cheerio.CheerioAPI): PlayByPlayInning[] {
  const innings: PlayByPlayInning[] = [];
  const pbpTab = $('#play-by-play');

  if (pbpTab.length === 0) {
    return innings;
  }

  const processedInnings = new Set<string>();

  pbpTab.find('table').each((_, table) => {
    const $table = $(table);
    const caption = $table.find('caption').text() || '';

    if (!caption.toLowerCase().includes('wellesley')) {
      return;
    }

    const inningKey = caption.replace(/Wellesley\s*-\s*(Top|Bottom)\s+of\s*/gi, '').trim();

    if (processedInnings.has(inningKey)) {
      return;
    }

    processedInnings.add(inningKey);

    const plays: string[] = [];
    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const firstCell = $row.find('td').first();
      const originalText = (firstCell.length ? firstCell.text() : $row.text()).trim() || '';
      const text = originalText.toLowerCase();

      if (!originalText || text.includes('play description') || text.length < 5) {
        return;
      }

      if (text.includes('inning summary') || text.match(/^\d+(st|nd|rd|th)\s+inning/i)) {
        return;
      }

      plays.push(originalText);
    });

    if (plays.length > 0) {
      innings.push({ inning: inningKey, plays });
    }
  });

  return innings;
}

function extractGameData($: cheerio.CheerioAPI, url: string): SerializedGameData {
  const lineup = parseLineup($);
  const playByPlay = parsePlayByPlay($);

  const opponentMatch = url.match(/stats\/\d{4}\/([^/]+)\//);
  const opponent = opponentMatch ? opponentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';

  return {
    url,
    opponent,
    lineup: Array.from(lineup.entries()),
    playByPlay,
  };
}

// ── wOBA data extraction ──

function parseStatsTable($: cheerio.CheerioAPI, year: number): { players: SeasonStats[]; teamGames: number } {
  const players: SeasonStats[] = [];
  let teamGames = 0;

  let targetTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (caption.includes('Individual Overall Batting Statistics')) {
      targetTable = $(table);

      return false;
    }
  });

  if (!targetTable) {
    return { players, teamGames };
  }

  targetTable.find('tbody tr').each((_: number, row: any) => {
    const $row = $(row);
    const nameCell = $row.find('th[scope="row"]');
    const name = nameCell.find('a.hide-on-medium-down').text().trim() || nameCell.find('a').first().text().trim() || nameCell.text().trim();

    if (!name || name.toLowerCase() === 'opponents') {
      return;
    }

    const num = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseInt(cell.text().trim(), 10) || 0;
    };

    const pct = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseFloat(cell.text().trim()) || 0;
    };

    // GP-GS is hyphenated: "35-35"
    const gpGsCell = $row.find('td[data-label="GP-GS"]').text().trim();
    const gpGsMatch = gpGsCell.match(/^(\d+)-(\d+)$/);
    const gp = gpGsMatch ? parseInt(gpGsMatch[1], 10) : 0;
    const gs = gpGsMatch ? parseInt(gpGsMatch[2], 10) : 0;

    // SB column may be hyphenated: "12-15" (SB-SBA)
    const sbCell = $row.find('td[data-label="SB"]').text().trim();
    const sbMatch = sbCell.match(/^(\d+)-(\d+)$/);
    const sb = sbMatch ? parseInt(sbMatch[1], 10) : parseInt(sbCell, 10) || 0;
    const sbAtt = sbMatch ? parseInt(sbMatch[2], 10) : sb;

    // Totals row — capture team GP then skip
    if (name.toLowerCase() === 'totals') {
      teamGames = gp;

      return;
    }

    const ab = num('AB');
    const h = num('H');
    const doubles = num('2B');
    const triples = num('3B');
    const hr = num('HR');
    const bb = num('BB');
    const hbp = num('HBP');
    const sf = num('SF');
    const sh = num('SH');
    const pa = ab + bb + sf + sh + hbp;

    const woba = calculateWoba({
      ab,
      h,
      doubles,
      triples,
      hr,
      bb,
      hbp,
      sf,
      sh,
    });

    players.push({
      year,
      name,
      avg: pct('AVG'),
      ops: pct('OPS'),
      gp,
      gs,
      ab,
      r: num('R'),
      h,
      doubles,
      triples,
      hr,
      rbi: num('RBI'),
      tb: num('TB'),
      slg: pct('SLG%'),
      bb,
      hbp,
      so: num('SO'),
      gdp: num('GDP'),
      obp: pct('OB%'),
      sf,
      sh,
      sb,
      sbAtt,
      woba,
      pa,
    });
  });

  // Fallback: use max GP if totals row wasn't found
  if (teamGames === 0 && players.length > 0) {
    teamGames = Math.max(...players.map((p) => p.gp));
  }

  return { players, teamGames };
}

function parseGameInfo($: cheerio.CheerioAPI, url: string): { date: string; opponent: string } {
  let date = '';
  $('dt').each((_, el) => {
    if ($(el).text().trim() === 'Date') {
      date = $(el).next('dd').text().trim();

      return false;
    }
  });

  if (!date) {
    const title = $('title').text();
    const titleMatch = title.match(/on (\d{1,2}\/\d{1,2}\/\d{4})/);
    if (titleMatch) {
      date = titleMatch[1];
    }
  }

  const opponentMatch = url.match(/stats\/\d{4}\/([^/]+)\//);
  const opponent = opponentMatch ? opponentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';

  return { date, opponent };
}

/**
 * Match a stats-page player name (e.g. "Smith, Jane") to a roster key (e.g. "smith, jane").
 * Returns the matching roster key or null.
 */
function matchStatNameToRoster(statName: string, roster: Roster): string | null {
  const normalized = normalizeName(statName);

  // Exact match
  if (roster[normalized]) {
    return normalized;
  }

  // Surname fallback
  const statLast = normalized.split(',')[0].trim();

  return (
    Object.keys(roster).find((key) => {
      const rosterLast = key.split(',')[0].trim();

      return statLast.length > 2 && statLast === rosterLast;
    }) ?? null
  );
}

function lastNameMatch(a: string, b: string): boolean {
  const lastA = a.split(',')[0].trim();
  const lastB = b.split(',')[0].trim();

  return lastA.length > 2 && lastA === lastB;
}

function attributeStatToPlayers(text: string, playerMap: Map<string, GameBattingStats>, field: 'doubles' | 'triples' | 'hr' | 'hbp' | 'sf' | 'sh'): void {
  const playerRegex = /([\w][\w\s,.'"-]+?)\s*\((\d+)\)/g;
  let match;
  while ((match = playerRegex.exec(text)) !== null) {
    const playerName = match[1].trim();
    const count = parseInt(match[2], 10);
    const normalized = normalizeName(playerName);

    const stats = playerMap.get(normalized);
    if (stats) {
      stats[field] = count;
    } else {
      for (const [key, s] of playerMap.entries()) {
        if (lastNameMatch(key, normalized)) {
          s[field] = count;
          break;
        }
      }
    }
  }
}

function parseSupplementaryStats($: cheerio.CheerioAPI, playerMap: Map<string, GameBattingStats>): void {
  const dtDdStats: Array<{
    label: string;
    field: 'doubles' | 'triples' | 'hr' | 'sf' | 'sh';
  }> = [
    { label: '2B:', field: 'doubles' },
    { label: '3B:', field: 'triples' },
    { label: 'HR:', field: 'hr' },
    { label: 'SF:', field: 'sf' },
    { label: 'SH:', field: 'sh' },
  ];

  dtDdStats.forEach(({ label, field }) => {
    $('dt').each((_, dt) => {
      if ($(dt).text().trim() !== label) {
        return;
      }

      const dd = $(dt).next('dd');
      const ddText = dd.text().trim();

      if (!ddText || ddText.toLowerCase() === 'none') {
        return;
      }

      attributeStatToPlayers(ddText, playerMap, field);
    });
  });

  $('td').each((_, td) => {
    const text = $(td).text().trim();
    const hbpMatch = text.match(/^HBP:\s*(.+)$/i);

    if (!hbpMatch) {
      return;
    }

    const line = hbpMatch[1].trim();

    if (line.toLowerCase() === 'none') {
      return;
    }

    attributeStatToPlayers(line, playerMap, 'hbp');
  });
}

function extractBoxscoreBatting($: cheerio.CheerioAPI, url: string): BoxscoreData | null {
  const { date, opponent } = parseGameInfo($, url);
  const playerStats: GameBattingStats[] = [];
  const playerMap = new Map<string, GameBattingStats>();

  let wellesleyTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (caption.includes('Wellesley') && !caption.toLowerCase().includes('pitching') && !caption.includes('Top of') && !caption.includes('Bottom of') && !caption.includes('Scoring Summary')) {
      wellesleyTable = $(table);

      return false;
    }
  });

  if (!wellesleyTable) {
    return null;
  }

  wellesleyTable.find('tbody tr').each((_: number, row: any) => {
    const $row = $(row);
    const cells = $row.find('td');

    if (cells.length < 3) {
      return;
    }

    const playerLink = $row.find('.boxscore_player_link');
    const name = playerLink.text().trim();

    if (!name) {
      return;
    }

    const num = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseInt(cell.text().trim(), 10) || 0;
    };

    const stats: GameBattingStats = {
      name,
      ab: num('AB'),
      h: num('H'),
      doubles: 0,
      triples: 0,
      hr: 0,
      bb: num('BB'),
      hbp: 0,
      sf: 0,
      sh: 0,
    };

    playerMap.set(normalizeName(name), stats);
    playerStats.push(stats);
  });

  parseSupplementaryStats($, playerMap);

  return { date, opponent, url, playerStats };
}

// ── Pitching data extraction ──

function parsePitchingStatsTable($: cheerio.CheerioAPI): PitchingStatsRow[] {
  const pitchers: PitchingStatsRow[] = [];

  let targetTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (caption.includes('Individual Overall Pitching Statistics')) {
      targetTable = $(table);

      return false;
    }
  });

  if (!targetTable) {
    return pitchers;
  }

  targetTable.find('tbody tr').each((_: number, row: any) => {
    const $row = $(row);
    const nameCell = $row.find('th[scope="row"]');
    const name = nameCell.find('a.hide-on-medium-down').text().trim() || nameCell.find('a').first().text().trim() || nameCell.text().trim();

    if (!name || name.toLowerCase() === 'totals' || name.toLowerCase() === 'opponents' || !/[a-zA-Z]/.test(name)) {
      return;
    }

    const num = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseInt(cell.text().trim(), 10) || 0;
    };

    const pct = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseFloat(cell.text().trim()) || 0;
    };

    const wlCell = $row.find('td[data-label="W-L"]').text().trim();
    const wlMatch = wlCell.match(/^(\d+)-(\d+)$/);
    const w = wlMatch ? parseInt(wlMatch[1], 10) : 0;
    const l = wlMatch ? parseInt(wlMatch[2], 10) : 0;

    const appGsCell = $row.find('td[data-label="APP-GS"]').text().trim();
    const appGsMatch = appGsCell.match(/^(\d+)-(\d+)$/);
    const app = appGsMatch ? parseInt(appGsMatch[1], 10) : 0;
    const gs = appGsMatch ? parseInt(appGsMatch[2], 10) : 0;

    const ipText = $row.find('td[data-label="IP"]').text().trim();
    const ip = parseFloat(ipText) || 0;

    pitchers.push({
      name,
      w,
      l,
      era: pct('ERA'),
      app,
      gs,
      cg: num('CG'),
      sho: num('SHO'),
      sv: num('SV'),
      ip,
      h: num('H'),
      r: num('R'),
      er: num('ER'),
      bb: num('BB'),
      so: num('SO'),
      hr: num('HR'),
      whip: pct('WHIP'),
      doubles: num('2B'),
      triples: num('3B'),
      ab: num('AB'),
      bAvg: pct('B/AVG'),
      wp: num('WP'),
      hbp: num('HBP'),
      bk: num('BK'),
      sfa: num('SFA'),
      sha: num('SHA'),
    });
  });

  return pitchers;
}

/** Check if a caption belongs to Wellesley */
function captionMatchesWellesley(caption: string): boolean {
  return caption.toLowerCase().includes('wellesley');
}

/** Parse all play-by-play tables from a boxscore page (both teams) */
function parseAllPlayByPlay($: cheerio.CheerioAPI): PbPInning[] {
  const innings: PbPInning[] = [];
  const pbpTab = $('#play-by-play');

  if (pbpTab.length === 0) {
    return innings;
  }

  const seen = new Set<string>();

  pbpTab.find('table').each((_, table) => {
    const $table = $(table);
    const caption = $table.find('caption').text() || '';

    if (!caption) {
      return;
    }

    const teamName = caption.replace(/\s*-\s*(Top|Bottom)\s+of\s+.*/i, '').trim();

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
      const originalText = (firstCell.length ? firstCell.text() : $row.text()).trim() || '';
      const text = originalText.toLowerCase();

      if (!originalText || text.includes('play description') || text.length < 5) {
        return;
      }

      if (text.includes('inning summary') || text.match(/^\d+(st|nd|rd|th)\s+inning/i)) {
        return;
      }

      plays.push(originalText);
    });

    if (plays.length > 0) {
      innings.push({ inning, teamName, plays });
    }
  });

  return innings;
}

/** Filter play-by-play to only innings where opponents bat (against Wellesley pitchers) */
function parseDefensiveInnings($: cheerio.CheerioAPI): { inning: string; plays: string[] }[] {
  const allInnings = parseAllPlayByPlay($);

  // Non-Wellesley batting innings = when opponents bat against Wellesley pitchers
  return allInnings.filter((inn) => !captionMatchesWellesley(inn.teamName)).map((inn) => ({ inning: inn.inning, plays: inn.plays }));
}

/** Extract Wellesley's pitchers from the boxscore pitching table, in appearance order */
function parseWellesleyPitchers($: cheerio.CheerioAPI): string[] {
  const pitchers: string[] = [];

  $('table').each((_, table) => {
    const caption = $(table).find('caption').text() || '';

    if (!caption.toLowerCase().includes('pitching')) {
      return;
    }

    if (!captionMatchesWellesley(caption)) {
      return;
    }

    $(table)
      .find('tbody tr')
      .each((_, row) => {
        const playerLink = $(row).find('.boxscore_player_link');
        const name = playerLink.text().trim();

        if (name) {
          pitchers.push(name);
        }
      });

    return false; // stop after first matching pitching table
  });

  return pitchers;
}

// ── Main orchestration ──

async function prefetchYear(year: number, outputDir: string): Promise<void> {
  console.log(`\n=== Prefetching ${year} ===`);

  // 1. Fetch schedule page to get boxscore URLs
  console.log(`  Fetching schedule page...`);
  const scheduleHtml = await fetchPage(`${BASE_URL}/sports/softball/schedule/${year}`);
  if (!scheduleHtml) {
    console.log(`  No schedule page for ${year}, skipping`);

    return;
  }

  const $schedule = cheerio.load(scheduleHtml);
  const boxscoreUrls = extractBoxscoreUrls($schedule);
  console.log(`  Found ${boxscoreUrls.length} boxscore URLs`);

  if (boxscoreUrls.length === 0) {
    console.log(`  No boxscores for ${year}, skipping`);

    return;
  }

  // 2. Fetch stats page for season totals
  console.log(`  Fetching stats page...`);
  await delay(DELAY_MS);
  const statsHtml = await fetchPage(`${BASE_URL}/sports/softball/stats/${year}`);
  const $stats = statsHtml ? cheerio.load(statsHtml) : null;
  const { players: seasonStats, teamGames } = $stats ? parseStatsTable($stats, year) : { players: [], teamGames: 0 };
  console.log(`  Parsed ${seasonStats.length} players from stats table (${teamGames} team GP)`);
  const pitchingStats = $stats ? parsePitchingStatsTable($stats) : [];
  console.log(`  Parsed ${pitchingStats.length} pitchers from stats table`);

  // 3. Fetch each boxscore and extract game data, woba batting data, and pitching data
  const gameDataList: SerializedGameData[] = [];
  const boxscoreDataList: BoxscoreData[] = [];
  const pitchingGameList: GamePitchingData[] = [];

  for (let i = 0; i < boxscoreUrls.length; i++) {
    const url = boxscoreUrls[i];
    console.log(`  Fetching boxscore ${i + 1}/${boxscoreUrls.length}: ${url}`);
    await delay(DELAY_MS);

    const html = await fetchPage(url);

    if (!html) {
      continue;
    }

    const $ = cheerio.load(html);

    const gameData = extractGameData($, url);
    gameDataList.push(gameData);

    const boxscoreData = extractBoxscoreBatting($, url);

    if (boxscoreData) {
      boxscoreDataList.push(boxscoreData);
    }

    // Extract pitching data (Wellesley pitchers + opponent batting innings)
    const wellesleyPitchers = parseWellesleyPitchers($);
    const defensiveInnings = parseDefensiveInnings($);

    if (wellesleyPitchers.length > 0 || defensiveInnings.length > 0) {
      const { date, opponent } = parseGameInfo($, url);
      pitchingGameList.push({
        year,
        url,
        date,
        opponent,
        pitchers: wellesleyPitchers,
        battingInnings: defensiveInnings,
      });
    }
  }

  // 4. Write JSON files
  const gamedataPath = path.join(outputDir, dataFilename('gamedata', year));
  fs.writeFileSync(gamedataPath, JSON.stringify(gameDataList));
  console.log(`  Wrote ${gamedataPath} (${gameDataList.length} games)`);

  // Load roster for enriching player data
  const rosterPath = path.join(outputDir, 'roster.json');
  let roster: Roster = {};

  if (fs.existsSync(rosterPath)) {
    roster = JSON.parse(fs.readFileSync(rosterPath, 'utf-8'));
  }

  // Build YearBattingData with enriched player info from roster
  const yearPlayers: YearPlayer[] = seasonStats.map((stat) => {
    // Match stat name to roster by last name
    const rosterKey = matchStatNameToRoster(stat.name, roster);
    const rosterEntry = rosterKey ? roster[rosterKey] : null;

    return {
      name: stat.name,
      jerseyNumber: rosterEntry?.jersey ?? null,
      classYear: rosterEntry?.classYear ?? '',
      position: rosterEntry?.position ?? null,
      bats: rosterEntry?.bats ?? null,
      season: stat,
    };
  });

  const battingStatsPath = path.join(outputDir, dataFilename('batting-stats', year));
  const battingData: YearBattingData = {
    slug: 'wellesley',
    domain: 'wellesleyblue.com',
    scrapedAt: new Date().toISOString(),
    year,
    teamGames,
    players: yearPlayers,
    boxscores: boxscoreDataList,
  };
  fs.writeFileSync(battingStatsPath, JSON.stringify(battingData));
  console.log(`  Wrote ${battingStatsPath} (${yearPlayers.length} players, ${boxscoreDataList.length} boxscores)`);

  const pitchingPath = path.join(outputDir, dataFilename('pitching', year));
  const pitchingOutput: PitchingOutput = {
    slug: 'wellesley',
    domain: 'wellesleyblue.com',
    scrapedAt: new Date().toISOString(),
    year,
    pitchingStats,
    games: pitchingGameList,
  };
  fs.writeFileSync(pitchingPath, JSON.stringify(pitchingOutput));
  console.log(`  Wrote ${pitchingPath} (${pitchingStats.length} pitchers, ${pitchingGameList.length} games)`);
}

// ── Roster scraping (jersey numbers) ──

function parseRoster($: cheerio.CheerioAPI): Roster {
  const roster: Roster = {};

  // Wellesley's Sidearm Sports page has two parallel element sets:
  // 1. Table-view <li.sidearm-roster-player>: jersey + position
  // 2. Card-view <li.sidearm-list-card-item>: first/last name + class year + B/T
  // We also use <tr> with .sidearm-table-player-name for the reliable name + jersey.

  // Card view: extract class year and B/T by name
  const cardData = new Map<string, { classYear: string; bats: BatHand | null; throws: 'L' | 'R' | null }>();
  $('li.sidearm-list-card-item').each((_, el) => {
    const $el = $(el);
    const firstName = $el.find('.sidearm-roster-player-first-name').text().trim();
    const lastName = $el.find('.sidearm-roster-player-last-name').text().trim();

    if (!firstName || !lastName) {
      return;
    }

    const key = `${normalizeName(lastName)}, ${normalizeName(firstName)}`;
    const yearEls = $el.find('.sidearm-roster-player-academic-year');
    const classYear =
      yearEls.length > 1
        ? $(yearEls[yearEls.length - 1])
            .text()
            .trim()
        : yearEls.text().trim();

    // B/T (bats/throws)
    let bats: BatHand | null = null;
    let throws: 'L' | 'R' | null = null;
    const btSelectors = ['[data-custom-label="B/T:"]', '[data-custom-label="B-T:"]', '.sidearm-roster-player-custom2', '.sidearm-roster-player-custom3'];
    btSelectors.some((sel) => {
      const text = $el.find(sel).text().trim();
      const btMatch = text.match(/([LRS])\s*[/-]\s*([LR])/i);

      if (btMatch) {
        const b = btMatch[1].toUpperCase();
        const t = btMatch[2].toUpperCase();
        bats = (b === 'L' || b === 'R' || b === 'S' ? b : null) as BatHand | null;
        throws = (t === 'L' || t === 'R' ? t : null) as 'L' | 'R' | null;

        return true;
      }

      return false;
    });

    cardData.set(key, { classYear: classYear || '', bats, throws });
  });

  // Table view: extract position by jersey number
  const positionByJersey = new Map<number, string>();
  $('li.sidearm-roster-player').each((_, el) => {
    const $el = $(el);
    const jn = parseInt($el.find('.sidearm-roster-player-jersey-number').text().trim(), 10);
    const pos = $el.find('.sidearm-roster-player-position span.text-bold').text().trim() || $el.find('.sidearm-roster-player-position').text().trim();

    if (!isNaN(jn) && pos) {
      positionByJersey.set(jn, pos);
    }
  });

  // Main: table rows (reliable name + jersey)
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
    const jerseyNum = parseInt(jersey, 10);

    const card = cardData.get(key);

    roster[key] = {
      jersey: jerseyNum,
      classYear: card?.classYear ?? '',
      position: positionByJersey.get(jerseyNum) ?? null,
      bats: card?.bats ?? null,
      throws: card?.throws ?? null,
    };
  });

  return roster;
}

async function prefetchRoster(outputDir: string): Promise<void> {
  console.log('\n=== Fetching roster ===');
  const html = await fetchPage(`${BASE_URL}/sports/softball/roster`);

  if (!html) {
    console.log('  Could not fetch roster page');

    return;
  }

  const $ = cheerio.load(html);
  const roster = parseRoster($);
  const outPath = path.join(outputDir, 'roster.json');
  fs.writeFileSync(outPath, JSON.stringify(roster));
  console.log(`  Wrote ${outPath} (${Object.keys(roster).length} players)`);
}

async function main(): Promise<void> {
  const years = parseYearsArg();
  const rosterOnly = parseRosterOnlyFlag();
  const outputDir = path.resolve(__dirname, '../public/data');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Output directory: ${outputDir}`);

  await prefetchRoster(outputDir);

  if (rosterOnly) {
    console.log('\n--roster-only: skipping game/woba data');
    console.log('\nDone!');

    return;
  }

  console.log(`Prefetching data for years: ${years.join(', ')}`);

  for (const year of years) {
    await prefetchYear(year, outputDir);
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
