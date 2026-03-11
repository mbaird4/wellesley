/**
 * Scrape opponent team rosters, batting stats (with derived wOBA), and
 * optionally pitching play-by-play data or full gamedata (lineup + play-by-play).
 *
 * Current-year gamedata uses unsuffixed names (gamedata.json);
 * historical files keep year suffixes (gamedata-2025.json, etc.).
 *
 * Usage:
 *   npm run scrape-opponents                                     # all teams, batting only
 *   npm run scrape-opponents -- --team wpi                        # single team
 *   npm run scrape-opponents -- --years 2024,2025                 # override years
 *   npm run scrape-opponents -- --with-pitching                   # include pitching data
 *   npm run scrape-opponents -- --with-gamedata                   # include full gamedata
 *   npm run scrape-opponents -- --roster-only                     # rosters only, skip stats
 *   npm run scrape-opponents -- --team wpi --with-gamedata --years 2025
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

/** Known name aliases used in boxscore captions for team matching */
const TEAM_ALIASES: Record<string, string[]> = {
  wpi: ['WPI', 'Worcester Polytechnic'],
  wheaton: ['Wheaton'],
  springfield: ['Springfield'],
  smith: ['Smith'],
  salve: ['Salve Regina', 'Salve'],
  mit: ['MIT'],
  emerson: ['Emerson'],
  coastguard: ['Coast Guard', 'USCGA'],
  clark: ['Clark'],
  babson: ['Babson'],
};

// ── Florida Sidearm Teams ──

const FLORIDA_SIDEARM_TEAMS: Record<string, string> = {
  wesleyan: 'athletics.wesleyan.edu',
  uwrf: 'uwrfsports.com',
  brockport: 'gobrockport.com',
  macalester: 'athletics.macalester.edu',
  ecsu: 'gowarriorathletics.com',
  uww: 'uwwsports.com',
};

const FLORIDA_SIDEARM_ALIASES: Record<string, string[]> = {
  wesleyan: ['Wesleyan'],
  uwrf: ['UW-River Falls', 'River Falls'],
  brockport: ['Brockport', 'SUNY Brockport'],
  macalester: ['Macalester'],
  ecsu: ['Eastern Connecticut', 'Eastern Conn', 'ECSU'],
  uww: ['UW-Whitewater', 'Whitewater'],
};

// ── Types ──

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

// ── Pitching scraping types ──

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
  pitchingStatsByYear: Record<string, PitchingStatsRow[]>;
  games: GamePitchingData[];
}

// ── Gamedata scraping types ──

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

interface GamedataOutput {
  slug: string;
  domain: string;
  scrapedAt: string;
  gamesByYear: Record<string, GamedataSerializedGame[]>;
}

// ── Constants ──

const DELAY_MS = 500;
const DEFAULT_YEARS = [2026, 2025, 2024, 2023];

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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
      console.warn(`  Skipping ${url}: response too short (${html?.length ?? 0} chars)`);

      return null;
    }

    return html;
  } catch (error: any) {
    console.warn(`  Failed to fetch ${url}: ${error.message}`);

    return null;
  }
}

// ── wOBA calculation (inlined from src/lib/woba.ts) ──

function calculateWoba(stats: { ab: number; h: number; doubles: number; triples: number; hr: number; bb: number; hbp: number; sf: number; sh: number }): number {
  const singles = stats.h - stats.doubles - stats.triples - stats.hr;
  const denominator = stats.ab + stats.bb + stats.sf + stats.sh + stats.hbp;
  if (denominator === 0) return 0;
  const numerator = 0.5 * stats.bb + 0.5 * stats.hbp + 0.9 * singles + 1.2 * stats.doubles + 1.7 * stats.triples + 2.5 * stats.hr;

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

    const jerseyText = $el.find('.sidearm-roster-player-jersey-number').text().trim();
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

    // Position — teams customize which selector is used.
    // Some templates nest long/short variants; grab the most specific match first.
    const posText = $el.find('.rp_position_short').first().text().trim() || $el.find('.sidearm-roster-player-position-long-short').first().text().trim() || $el.find('.sidearm-roster-player-position span.text-bold').first().text().trim() || $el.find('.sidearm-roster-player-position').first().text().trim();
    const position = posText || null;

    // B/T — teams customize which element holds this; try multiple selectors.
    // Use .first() because some templates duplicate the element (abbreviated + full rows).
    let bats: BatHand | null = null;
    let throws: 'L' | 'R' | null = null;
    const btText = $el.find('[data-custom-label="B/T:"]').first().text().trim() || $el.find('[data-custom-label="B-T:"]').first().text().trim() || $el.find('.sidearm-roster-player-custom1').first().text().trim() || $el.find('.sidearm-roster-player-custom2').first().text().trim() || $el.find('.sidearm-roster-player-custom3').first().text().trim();
    if (btText && /[LRS]\s*[/-]\s*[LR]/i.test(btText)) {
      const btParts = btText.split(/[/-]/);
      const batChar = btParts[0]?.trim().toUpperCase();
      if (batChar === 'L' || batChar === 'R' || batChar === 'S') {
        bats = batChar;
      }

      const throwChar = btParts[1]?.trim().toUpperCase();
      if (throwChar === 'L' || throwChar === 'R') {
        throws = throwChar;
      }
    }

    players.push({
      name: fullName,
      firstName,
      lastName,
      jerseyNumber,
      classYear,
      position,
      bats,
      throws,
    });
  });

  return players;
}

// ── Batting stats table parsing ──

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
    const name = nameCell.find('a.hide-on-medium-down').text().trim() || nameCell.find('a').first().text().trim() || nameCell.text().trim();

    if (!name || name.toLowerCase() === 'totals' || name.toLowerCase() === 'opponents') return;

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

// ── Pitching stats table parsing ──

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

  if (!targetTable) return pitchers;

  targetTable.find('tbody tr').each((_: number, row: any) => {
    const $row = $(row);
    const nameCell = $row.find('th[scope="row"]');
    const name = nameCell.find('a.hide-on-medium-down').text().trim() || nameCell.find('a').first().text().trim() || nameCell.text().trim();

    if (!name || name.toLowerCase() === 'totals' || name.toLowerCase() === 'opponents' || !/[a-zA-Z]/.test(name)) return;

    const num = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseInt(cell.text().trim(), 10) || 0;
    };

    const pct = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);

      return parseFloat(cell.text().trim()) || 0;
    };

    // W-L is formatted "w-l" (e.g. "12-3")
    const wlCell = $row.find('td[data-label="W-L"]').text().trim();
    const wlMatch = wlCell.match(/^(\d+)-(\d+)$/);
    const w = wlMatch ? parseInt(wlMatch[1], 10) : 0;
    const l = wlMatch ? parseInt(wlMatch[2], 10) : 0;

    // APP-GS column is formatted "app-gs" (e.g. "15-12")
    const appGsCell = $row.find('td[data-label="APP-GS"]').text().trim();
    const appGsMatch = appGsCell.match(/^(\d+)-(\d+)$/);
    const app = appGsMatch ? parseInt(appGsMatch[1], 10) : 0;
    const gs = appGsMatch ? parseInt(appGsMatch[2], 10) : 0;

    // IP can be fractional (e.g. "45.1" means 45 and 1/3 innings)
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

// ── Team GP from Totals row ──

function parseTeamGames($: cheerio.CheerioAPI): number | null {
  let targetTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (caption.includes('Individual Overall Batting Statistics')) {
      targetTable = $(table);

      return false;
    }
  });

  if (!targetTable) return null;

  let teamGp: number | null = null;
  targetTable.find('tbody tr').each((_: number, row: any) => {
    const $row = $(row);
    const nameCell = $row.find('th[scope="row"]');
    const name = nameCell.find('a.hide-on-medium-down').text().trim() || nameCell.find('a').first().text().trim() || nameCell.text().trim();

    if (name.toLowerCase() === 'totals') {
      const gpGsCell = $row.find('td[data-label="GP-GS"]').text().trim();
      const gpGsMatch = gpGsCell.match(/^(\d+)-(\d+)$/);
      teamGp = gpGsMatch ? parseInt(gpGsMatch[1], 10) : null;

      return false;
    }
  });

  return teamGp;
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

function parseWithPitchingFlag(): boolean {
  return process.argv.includes('--with-pitching');
}

function parseWithGamedataFlag(): boolean {
  return process.argv.includes('--with-gamedata');
}

function parseRosterOnlyFlag(): boolean {
  return process.argv.includes('--roster-only');
}

function parseFloridaFlag(): boolean {
  return process.argv.includes('--florida');
}

const CURRENT_YEAR = new Date().getFullYear();

function gamedataFilename(year: number): string {
  return year === CURRENT_YEAR ? 'gamedata.json' : `gamedata-${year}.json`;
}

function battingFilename(year: number): string {
  return year === CURRENT_YEAR ? 'batting-stats.json' : `batting-stats-${year}.json`;
}

function pitchingFilename(year: number): string {
  return year === CURRENT_YEAR ? 'pitching.json' : `pitching-${year}.json`;
}

// ── Empty career stats for first-years ──

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

// ── Boxscore URL extraction (same pattern as prefetch-data.ts) ──

function extractBoxscoreUrls($: cheerio.CheerioAPI, domain: string): string[] {
  const baseUrl = `https://${domain}`;
  const urls: string[] = [];

  let links = $('.sidearm-schedule-game-links-boxscore a');

  if (links.length === 0) {
    links = $('a[href*="boxscore"]');
  }

  links.each((_, element) => {
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    urls.push(fullUrl);
  });

  return [...new Set(urls)];
}

// ── Play-by-play parsing for opponent pitching ──

/** Check if a caption belongs to the scraped team */
function captionMatchesTeam(caption: string, teamAliases: string[]): boolean {
  const lower = caption.toLowerCase();

  return teamAliases.some((alias) => lower.includes(alias.toLowerCase()));
}

/** Parse all play-by-play tables from a boxscore page */
function parseAllPlayByPlay($: cheerio.CheerioAPI): PbPInning[] {
  const innings: PbPInning[] = [];
  const pbpTab = $('#play-by-play');

  if (pbpTab.length === 0) {
    return innings;
  }

  // Sidearm Sports renders the play-by-play tables twice in the DOM
  // (an "all plays" view and a filtered view). Deduplicate by
  // (teamName, inning) key — keep only the first occurrence.
  const seen = new Set<string>();

  pbpTab.find('table').each((_, table) => {
    const $table = $(table);
    const caption = $table.find('caption').text() || '';

    if (!caption) {
      return;
    }

    // Extract team name and inning from caption
    // Format: "TeamName - Top/Bottom of 1st" or similar
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

/** Parse all pitchers from the boxscore pitching table, in appearance order */
function parseTeamPitchers($: cheerio.CheerioAPI, teamAliases: string[]): string[] {
  const pitchers: string[] = [];

  $('table').each((_, table) => {
    const caption = $(table).find('caption').text() || '';

    if (!caption.toLowerCase().includes('pitching')) {
      return;
    }

    if (!captionMatchesTeam(caption, teamAliases)) {
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

// ── Gamedata parsing (lineup + play-by-play for opponent teams) ──

/** Parse batting lineup for a specific team (adapted from prefetch-data.ts parseLineup) */
function parseTeamLineup($: cheerio.CheerioAPI, teamAliases: string[]): [number, string[]][] {
  const lineup = new Map<number, string[]>();

  $('table').each((_, table) => {
    const $table = $(table);
    const caption = $table.find('caption').text() || '';

    if (!captionMatchesTeam(caption, teamAliases)) {
      return;
    }

    // Skip pitching tables and play-by-play tables
    const lower = caption.toLowerCase();
    if (lower.includes('pitching') || caption.includes('Top of') || caption.includes('Bottom of') || caption.includes('Scoring Summary')) {
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

      // Extract player name: strip leading position text (e.g. "cf Emily Smith" → "Emily Smith")
      const nameMatch = playerText.match(/^[a-z/]+ (.+)$/i);
      const playerName = nameMatch ? nameMatch[1].trim() : playerText.trim();

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

    return false; // stop after first matching batting table
  });

  return Array.from(lineup.entries());
}

/** Parse play-by-play for both halves, labeling each as offense or defense */
function parseTeamPlayByPlay($: cheerio.CheerioAPI, teamAliases: string[]): GamedataPlayByPlayInning[] {
  const allInnings = parseAllPlayByPlay($);

  return allInnings.map((inn) => ({
    inning: inn.inning,
    half: captionMatchesTeam(inn.teamName, teamAliases) ? 'offense' : 'defense',
    plays: inn.plays,
  }));
}

/** Extract game date from boxscore page */
function parseGameDate($: cheerio.CheerioAPI, url: string): string {
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

  return date;
}

/** Extract opponent name from boxscore URL */
function parseOpponentFromUrl(url: string): string {
  const opponentMatch = url.match(/stats\/\d{4}\/([^/]+)\//);

  return opponentMatch ? opponentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';
}

/** Parse a single boxscore for pitching data (year added by caller) */
function parseBoxscorePitching($: cheerio.CheerioAPI, url: string, teamAliases: string[]): Omit<GamePitchingData, 'year'> | null {
  const allInnings = parseAllPlayByPlay($);

  if (allInnings.length === 0) {
    return null;
  }

  const date = parseGameDate($, url);
  const opponent = parseOpponentFromUrl(url);

  // Separate innings: team's fielding innings are when the OTHER team bats
  // The other team's batting innings = innings where caption team does NOT match our team
  const opponentBattingInnings = allInnings.filter((inn) => !captionMatchesTeam(inn.teamName, teamAliases));

  // Authoritative pitcher list from the pitching table (in appearance order)
  const pitchers = parseTeamPitchers($, teamAliases);

  // Build batting innings (plays against our team's pitcher)
  const battingInnings = opponentBattingInnings.map((inn) => ({
    inning: inn.inning,
    plays: inn.plays,
  }));

  return {
    url,
    date,
    opponent,
    pitchers,
    battingInnings,
  };
}

// ── Per-team batting scraping ──

async function scrapeTeam(slug: string, domain: string, years: number[]): Promise<TeamOutput> {
  console.log(`\n=== ${slug} (${domain}) ===`);

  // 1. Fetch roster
  console.log('  Fetching roster...');
  const rosterHtml = await fetchPage(`https://${domain}/sports/softball/roster`);
  const roster = rosterHtml ? parseRoster(cheerio.load(rosterHtml)) : [];
  console.log(`  Found ${roster.length} roster players`);

  // 2. Fetch stats for each year
  const statsByYear = new Map<number, BattingStats[]>();
  const teamGpByYear = new Map<number, number>();
  for (const year of years) {
    await delay(DELAY_MS);
    console.log(`  Fetching ${year} stats...`);
    const statsHtml = await fetchPage(`https://${domain}/sports/softball/stats/${year}`);
    if (statsHtml) {
      const $stats = cheerio.load(statsHtml);
      const stats = parseStatsTable($stats);
      statsByYear.set(year, stats);
      console.log(`    Parsed ${stats.length} players`);

      const teamGp = parseTeamGames($stats);
      if (teamGp !== null) {
        teamGpByYear.set(year, teamGp);
        console.log(`    Team GP: ${teamGp}`);
      } else {
        // Fallback: max player GP
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
  const matchResults = new Map<(typeof roster)[number], Map<number, BattingStats>>();
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
      if (!claimedStatsKeys.has(statsKey) && lastNameOnly(statsKey) === rosterLastName) {
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
      // First-year or unmatched player — include with empty stats
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
      continue;
    }

    const careerPa = careerTotals.ab + careerTotals.bb + careerTotals.sf + careerTotals.sh + careerTotals.hbp;
    const careerWoba = calculateWoba(careerTotals);

    // Compute career rate stats from totals
    const careerAvg = careerTotals.ab > 0 ? Math.round((careerTotals.h / careerTotals.ab) * 1000) / 1000 : 0;
    const careerSlg = careerTotals.ab > 0 ? Math.round((careerTotals.tb / careerTotals.ab) * 1000) / 1000 : 0;
    const careerObp = careerPa > 0 ? Math.round(((careerTotals.h + careerTotals.bb + careerTotals.hbp) / (careerTotals.ab + careerTotals.bb + careerTotals.hbp + careerTotals.sf)) * 1000) / 1000 : 0;
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
  }

  // Sort by career wOBA descending
  players.sort((a, b) => b.career.woba - a.career.woba);

  console.log(`  Matched: ${matched}, Unmatched roster players (no stats): ${unmatched}`);

  // Convert teamGpByYear map to plain object for JSON
  const teamGamesByYear: Record<string, number> = {};
  for (const [year, gp] of teamGpByYear) {
    teamGamesByYear[String(year)] = gp;
  }

  return {
    slug,
    domain,
    scrapedAt: new Date().toISOString(),
    players,
    teamGamesByYear,
  };
}

// ── Per-team pitching scraping ──

async function scrapeTeamPitching(slug: string, domain: string, years: number[]): Promise<PitchingOutput> {
  const teamAliases = TEAM_ALIASES[slug] || [slug];
  console.log(`\n  --- Pitching scrape for ${slug} ---`);

  const pitchingStatsByYear: Record<string, PitchingStatsRow[]> = {};
  const allGames: GamePitchingData[] = [];

  for (const year of years) {
    // Fetch pitching stats from the same stats page (already fetched for batting,
    // but we re-fetch here since pitching is opt-in and may run independently)
    console.log(`  Fetching ${year} pitching stats...`);
    await delay(DELAY_MS);
    const statsHtml = await fetchPage(`https://${domain}/sports/softball/stats/${year}`);

    if (statsHtml) {
      const $stats = cheerio.load(statsHtml);
      const pitchingStats = parsePitchingStatsTable($stats);
      pitchingStatsByYear[String(year)] = pitchingStats;
      console.log(`    Parsed ${pitchingStats.length} pitchers`);
    }

    // Fetch schedule to get boxscore URLs
    console.log(`  Fetching ${year} schedule...`);
    await delay(DELAY_MS);
    const scheduleHtml = await fetchPage(`https://${domain}/sports/softball/schedule/${year}`);

    if (!scheduleHtml) {
      console.log(`    No schedule page for ${year}`);
      continue;
    }

    const $schedule = cheerio.load(scheduleHtml);
    const boxscoreUrls = extractBoxscoreUrls($schedule, domain);
    console.log(`    Found ${boxscoreUrls.length} boxscore URLs`);

    // Fetch each boxscore and extract pitching data
    for (let i = 0; i < boxscoreUrls.length; i++) {
      const url = boxscoreUrls[i];
      console.log(`    Fetching boxscore ${i + 1}/${boxscoreUrls.length}: ${url}`);
      await delay(DELAY_MS);

      const html = await fetchPage(url);
      if (!html) {
        continue;
      }

      const $ = cheerio.load(html);
      const gameData = parseBoxscorePitching($, url, teamAliases);

      if (gameData && gameData.battingInnings.length > 0) {
        allGames.push({ ...gameData, year });
      }
    }
  }

  console.log(`  Pitching scrape complete: ${allGames.length} games with play-by-play`);

  return {
    slug,
    domain,
    scrapedAt: new Date().toISOString(),
    pitchingStatsByYear,
    games: allGames,
  };
}

// ── Per-team gamedata scraping ──

async function scrapeTeamGamedata(slug: string, domain: string, years: number[]): Promise<GamedataOutput> {
  const teamAliases = TEAM_ALIASES[slug] || [slug];
  console.log(`\n  --- Gamedata scrape for ${slug} ---`);

  const gamesByYear: Record<string, GamedataSerializedGame[]> = {};

  for (const year of years) {
    console.log(`  Fetching ${year} schedule...`);
    await delay(DELAY_MS);
    const scheduleHtml = await fetchPage(`https://${domain}/sports/softball/schedule/${year}`);

    if (!scheduleHtml) {
      console.log(`    No schedule page for ${year}`);
      continue;
    }

    const $schedule = cheerio.load(scheduleHtml);
    const boxscoreUrls = extractBoxscoreUrls($schedule, domain);
    console.log(`    Found ${boxscoreUrls.length} boxscore URLs`);

    const games: GamedataSerializedGame[] = [];

    for (let i = 0; i < boxscoreUrls.length; i++) {
      const url = boxscoreUrls[i];
      console.log(`    Fetching boxscore ${i + 1}/${boxscoreUrls.length}: ${url}`);
      await delay(DELAY_MS);

      const html = await fetchPage(url);
      if (!html) {
        continue;
      }

      const $ = cheerio.load(html);
      const lineup = parseTeamLineup($, teamAliases);
      const playByPlay = parseTeamPlayByPlay($, teamAliases);

      if (lineup.length === 0 && playByPlay.length === 0) {
        continue;
      }

      const opponent = parseOpponentFromUrl(url);
      const pitchers = parseTeamPitchers($, teamAliases).map(normalizeName);
      games.push({ year, url, opponent, pitchers, lineup, playByPlay });
    }

    if (games.length > 0) {
      gamesByYear[String(year)] = games;
    }

    console.log(`    ${year}: ${games.length} games with gamedata`);
  }

  const totalGames = Object.values(gamesByYear).reduce((sum, g) => sum + g.length, 0);
  console.log(`  Gamedata scrape complete: ${totalGames} total games`);

  return {
    slug,
    domain,
    scrapedAt: new Date().toISOString(),
    gamesByYear,
  };
}

// ── Main ──

async function main(): Promise<void> {
  const teamFilter = parseTeamArg();
  const years = parseYearsArg();
  const withPitching = parseWithPitchingFlag();
  const withGamedata = parseWithGamedataFlag();
  const rosterOnly = parseRosterOnlyFlag();
  const florida = parseFloridaFlag();
  const baseOutputDir = path.resolve(__dirname, '../public/data/opponents');
  const outputDir = florida ? path.join(baseOutputDir, 'florida') : baseOutputDir;
  fs.mkdirSync(outputDir, { recursive: true });

  const activeTeams = florida ? FLORIDA_SIDEARM_TEAMS : TEAMS;
  const activeAliases = florida ? FLORIDA_SIDEARM_ALIASES : TEAM_ALIASES;

  // Merge florida aliases into TEAM_ALIASES temporarily so downstream
  // functions (captionMatchesTeam, etc.) can find them
  if (florida) {
    Object.assign(TEAM_ALIASES, activeAliases);
  }

  const teamsToScrape = teamFilter ? { [teamFilter]: activeTeams[teamFilter] } : activeTeams;

  if (teamFilter && !activeTeams[teamFilter]) {
    console.error(`Unknown team slug: "${teamFilter}". Available: ${Object.keys(activeTeams).join(', ')}`);
    process.exit(1);
  }

  if (florida) {
    console.log('Mode: FLORIDA SIDEARM teams');
  }

  console.log(`Teams: ${Object.keys(teamsToScrape).join(', ')}`);
  console.log(`Output directory: ${outputDir}`);

  if (rosterOnly) {
    console.log('--roster-only: scraping rosters only');

    for (const [slug, domain] of Object.entries(teamsToScrape)) {
      console.log(`\n=== ${slug} (${domain}) ===`);
      console.log('  Fetching roster...');
      const rosterHtml = await fetchPage(`https://${domain}/sports/softball/roster`);
      const roster = rosterHtml ? parseRoster(cheerio.load(rosterHtml)) : [];
      const teamDir = path.join(outputDir, slug);
      fs.mkdirSync(teamDir, { recursive: true });
      const rosterOutPath = path.join(teamDir, 'roster.json');
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
      roster.forEach((rp) => {
        const key = normalizeName(`${rp.lastName}, ${rp.firstName}`);
        if (rp.jerseyNumber !== null) {
          enrichedRoster[key] = {
            jersey: rp.jerseyNumber,
            classYear: rp.classYear,
            position: rp.position,
            bats: rp.bats,
            throws: rp.throws,
          };
        }
      });
      fs.writeFileSync(rosterOutPath, JSON.stringify(enrichedRoster));
      console.log(`  Wrote ${rosterOutPath} (${Object.keys(enrichedRoster).length} players)`);

      if (Object.keys(teamsToScrape).length > 1) {
        await delay(DELAY_MS);
      }
    }

    console.log('\nDone!');

    return;
  }

  console.log(`Scraping opponents for years: ${years.join(', ')}`);
  console.log(`Pitching play-by-play: ${withPitching ? 'YES' : 'no'}`);
  console.log(`Full gamedata: ${withGamedata ? 'YES' : 'no'}`);

  for (const [slug, domain] of Object.entries(teamsToScrape)) {
    const teamDir = path.join(outputDir, slug);
    fs.mkdirSync(teamDir, { recursive: true });

    const result = await scrapeTeam(slug, domain, years);

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
        domain,
        scrapedAt,
        year,
        teamGames: result.teamGamesByYear[String(year)] ?? 0,
        players: yearPlayers,
      };
      const outPath = path.join(teamDir, battingFilename(year));
      fs.writeFileSync(outPath, JSON.stringify(yearData, null, 2));
      console.log(`  Wrote ${outPath} (${yearPlayers.length} players)`);
    });

    // Optionally scrape pitching play-by-play
    if (withPitching) {
      const pitchingResult = await scrapeTeamPitching(slug, domain, years);

      // Write per-year pitching files
      years.forEach((year) => {
        const stats = pitchingResult.pitchingStatsByYear[String(year)] ?? [];
        const games = pitchingResult.games.filter((g) => g.year === year);

        if (stats.length === 0 && games.length === 0) {
          return;
        }

        const yearData = {
          slug,
          domain,
          scrapedAt: pitchingResult.scrapedAt,
          year,
          pitchingStats: stats,
          games,
        };
        const outPath = path.join(teamDir, pitchingFilename(year));
        fs.writeFileSync(outPath, JSON.stringify(yearData, null, 2));
        console.log(`  Wrote ${outPath} (${stats.length} pitchers, ${games.length} games)`);
      });
    }

    // Optionally scrape full gamedata (lineup + play-by-play)
    if (withGamedata) {
      const gamedataResult = await scrapeTeamGamedata(slug, domain, years);

      Object.entries(gamedataResult.gamesByYear).forEach(([year, games]) => {
        const gamedataOutPath = path.join(teamDir, gamedataFilename(Number(year)));
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
