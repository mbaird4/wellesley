/**
 * Pre-fetch script: fetches boxscore data directly from wellesleyblue.com
 * (no CORS proxy needed in Node.js) and writes static JSON to public/data/.
 *
 * Usage:
 *   npm run prefetch                          # all years
 *   npm run prefetch -- --years 2025          # single year
 *   npm run prefetch -- --years 2025,2024     # multiple years
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Types (mirroring src/lib/types.ts, avoiding Angular imports) ──

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

interface PlayerSeasonStats {
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

interface PlayerGameStats {
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
  playerStats: PlayerGameStats[];
}

interface WobaSeasonData {
  seasonStats: PlayerSeasonStats[];
  boxscores: BoxscoreData[];
}

// ── Constants ──

const BASE_URL = 'https://wellesleyblue.com';
const DELAY_MS = 300;
const DEFAULT_YEARS = [
  2025, 2024, 2023, 2022, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011,
];

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

function extractPlayerName(cellText: string): string {
  const match = cellText.match(/^[a-z\/]+ (.+)$/i);
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
    const fullUrl = href.startsWith('http')
      ? href
      : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
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

      const isSubstitution =
        cellHtml.startsWith('&nbsp;&nbsp;&nbsp;&nbsp;') ||
        /^(&nbsp;){4,}/.test(cellHtml) ||
        /^(\u00A0|\s){4,}/.test(rawText);

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

    const inningKey = caption
      .replace(/Wellesley\s*-\s*(Top|Bottom)\s+of\s*/gi, '')
      .trim();

    if (processedInnings.has(inningKey)) {
      return;
    }
    processedInnings.add(inningKey);

    const plays: string[] = [];
    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const firstCell = $row.find('td').first();
      const originalText =
        (firstCell.length ? firstCell.text() : $row.text()).trim() || '';
      const text = originalText.toLowerCase();

      if (
        !originalText ||
        text.includes('play description') ||
        text.length < 5
      ) {
        return;
      }

      if (
        text.includes('inning summary') ||
        text.match(/^\d+(st|nd|rd|th)\s+inning/i)
      ) {
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

function extractGameData(
  $: cheerio.CheerioAPI,
  url: string
): SerializedGameData {
  const lineup = parseLineup($);
  const playByPlay = parsePlayByPlay($);

  const opponentMatch = url.match(/stats\/\d{4}\/([^/]+)\//);
  const opponent = opponentMatch
    ? opponentMatch[1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';

  return {
    url,
    opponent,
    lineup: Array.from(lineup.entries()),
    playByPlay,
  };
}

// ── wOBA data extraction ──

function parseStatsTable($: cheerio.CheerioAPI): PlayerSeasonStats[] {
  const players: PlayerSeasonStats[] = [];

  let targetTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (caption.includes('Individual Overall Batting Statistics')) {
      targetTable = $(table);
      return false;
    }
  });

  if (!targetTable) {
    return players;
  }

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
    ) {
      return;
    }

    const num = (label: string): number => {
      const cell = $row.find(`td[data-label="${label}"]`);
      return parseInt(cell.text().trim(), 10) || 0;
    };

    players.push({
      name,
      ab: num('AB'),
      h: num('H'),
      doubles: num('2B'),
      triples: num('3B'),
      hr: num('HR'),
      bb: num('BB'),
      hbp: num('HBP'),
      sf: num('SF'),
      sh: num('SH'),
    });
  });

  return players;
}

function parseGameInfo(
  $: cheerio.CheerioAPI,
  url: string
): { date: string; opponent: string } {
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
  const opponent = opponentMatch
    ? opponentMatch[1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';

  return { date, opponent };
}

function lastNameMatch(a: string, b: string): boolean {
  const lastA = a.split(',')[0].trim();
  const lastB = b.split(',')[0].trim();
  return lastA.length > 2 && lastA === lastB;
}

function attributeStatToPlayers(
  text: string,
  playerMap: Map<string, PlayerGameStats>,
  field: 'doubles' | 'triples' | 'hr' | 'hbp' | 'sf' | 'sh'
): void {
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

function parseSupplementaryStats(
  $: cheerio.CheerioAPI,
  playerMap: Map<string, PlayerGameStats>
): void {
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

function extractBoxscoreBatting(
  $: cheerio.CheerioAPI,
  url: string
): BoxscoreData | null {
  const { date, opponent } = parseGameInfo($, url);
  const playerStats: PlayerGameStats[] = [];
  const playerMap = new Map<string, PlayerGameStats>();

  let wellesleyTable: any = null;
  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();
    if (
      caption.includes('Wellesley') &&
      !caption.toLowerCase().includes('pitching') &&
      !caption.includes('Top of') &&
      !caption.includes('Bottom of') &&
      !caption.includes('Scoring Summary')
    ) {
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

    const stats: PlayerGameStats = {
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

// ── Main orchestration ──

async function prefetchYear(year: number, outputDir: string): Promise<void> {
  console.log(`\n=== Prefetching ${year} ===`);

  // 1. Fetch schedule page to get boxscore URLs
  console.log(`  Fetching schedule page...`);
  const scheduleHtml = await fetchPage(
    `${BASE_URL}/sports/softball/schedule/${year}`
  );
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

  // 2. Fetch stats page for wOBA season totals
  console.log(`  Fetching stats page...`);
  await delay(DELAY_MS);
  const statsHtml = await fetchPage(
    `${BASE_URL}/sports/softball/stats/${year}`
  );
  const seasonStats = statsHtml ? parseStatsTable(cheerio.load(statsHtml)) : [];
  console.log(`  Parsed ${seasonStats.length} players from stats table`);

  // 3. Fetch each boxscore and extract both game data and woba batting data
  const gameDataList: SerializedGameData[] = [];
  const boxscoreDataList: BoxscoreData[] = [];

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
  }

  // 4. Write JSON files
  const gamedataPath = path.join(outputDir, `gamedata-${year}.json`);
  fs.writeFileSync(gamedataPath, JSON.stringify(gameDataList));
  console.log(`  Wrote ${gamedataPath} (${gameDataList.length} games)`);

  const wobadataPath = path.join(outputDir, `wobadata-${year}.json`);
  const wobaData: WobaSeasonData = { seasonStats, boxscores: boxscoreDataList };
  fs.writeFileSync(wobadataPath, JSON.stringify(wobaData));
  console.log(
    `  Wrote ${wobadataPath} (${seasonStats.length} players, ${boxscoreDataList.length} boxscores)`
  );
}

async function main(): Promise<void> {
  const years = parseYearsArg();
  const outputDir = path.resolve(__dirname, '../public/data');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Prefetching data for years: ${years.join(', ')}`);
  console.log(`Output directory: ${outputDir}`);

  for (const year of years) {
    await prefetchYear(year, outputDir);
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
