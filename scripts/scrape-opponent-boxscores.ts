/**
 * Scrape opponent boxscore play-by-play data for spray chart analysis.
 *
 * Usage:
 *   npm run scrape-opponent-boxscores                         # all teams, current year
 *   npm run scrape-opponent-boxscores -- --team babson         # single team
 *   npm run scrape-opponent-boxscores -- --years 2025,2024     # override years
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

// ── Types (mirroring prefetch-data.ts) ──

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

// ── Constants ──

const DELAY_MS = 400;
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEARS = [CURRENT_YEAR];

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

// ── CLI arg parsing ──

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

// ── Schedule page → boxscore URLs ──

function extractBoxscoreUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
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

    const fullUrl = href.startsWith('http')
      ? href
      : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    urls.push(fullUrl);
  });

  return [...new Set(urls)];
}

// ── Auto-discover team name from boxscore tables ──

/**
 * Discover team name from play-by-play captions.
 *
 * PBP captions use the format "TeamName - Top of 1st" / "TeamName - Bottom of 1st"
 * which cleanly separates the team name from the inning info. This is more reliable
 * than batting table captions which append the score (e.g. "Babson 5").
 */
function discoverTeamName(
  $: cheerio.CheerioAPI,
  domain: string
): string | null {
  const pbpTab = $('#play-by-play');
  const teamNames = new Set<string>();
  const domainSlug = domain.split('.')[0].toLowerCase();

  // Extract team names from PBP captions: "TeamName - Top/Bottom of Nth"
  const pbpSource = pbpTab.length > 0 ? pbpTab : $('body');
  pbpSource.find('table').each((_, table) => {
    const caption = $(table).find('caption').text().trim();
    const match = caption.match(/^(.+?)\s*-\s*(?:Top|Bottom)\s+of\s/i);

    if (match) {
      teamNames.add(match[1].trim());
    }
  });

  if (teamNames.size === 0) {
    return null;
  }

  const unique = [...teamNames];

  // Pick the one matching the domain slug (not the opponent)
  const domainMatch = unique.find((name) => {
    const lower = name.toLowerCase().replace(/\s+/g, '');

    return (
      lower.includes(domainSlug) ||
      domainSlug.includes(lower.replace(/[^a-z]/g, '').slice(0, 6))
    );
  });

  if (domainMatch) {
    return domainMatch;
  }

  // Fallback: first non-opponent name (opponent varies per game, so just pick first)
  return unique[0];
}

// ── Game data extraction (lineup + play-by-play) — parameterized by team name ──

function parseLineup(
  $: cheerio.CheerioAPI,
  teamName: string
): Map<number, string[]> {
  const lineup = new Map<number, string[]>();
  const teamLower = teamName.toLowerCase();

  $('table').each((_, table) => {
    const $table = $(table);
    const header = ($table.find('caption').text() || '').toLowerCase();

    if (!header.includes(teamLower)) {
      return;
    }

    // Skip pitching, play-by-play, scoring tables
    if (
      header.includes('pitching') ||
      header.includes('top of') ||
      header.includes('bottom of') ||
      header.includes('scoring')
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

function parsePlayByPlay(
  $: cheerio.CheerioAPI,
  teamName: string
): PlayByPlayInning[] {
  const innings: PlayByPlayInning[] = [];
  const pbpTab = $('#play-by-play');
  const teamLower = teamName.toLowerCase();

  if (pbpTab.length === 0) {
    return innings;
  }

  const processedInnings = new Set<string>();

  pbpTab.find('table').each((_, table) => {
    const $table = $(table);
    const caption = $table.find('caption').text() || '';

    if (!caption.toLowerCase().includes(teamLower)) {
      return;
    }

    const inningKey = caption
      .replace(
        new RegExp(`${teamName}\\s*-\\s*(Top|Bottom)\\s+of\\s*`, 'gi'),
        ''
      )
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
  url: string,
  teamName: string
): SerializedGameData {
  const lineup = parseLineup($, teamName);
  const playByPlay = parsePlayByPlay($, teamName);

  // Extract opponent name from URL or page content
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

// ── Roster scraping (jersey numbers) ──

function parseRoster($: cheerio.CheerioAPI): Record<string, number> {
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

async function scrapeRoster(
  slug: string,
  domain: string,
  outputDir: string
): Promise<void> {
  console.log(`  Fetching roster...`);
  const html = await fetchPage(`https://${domain}/sports/softball/roster`);

  if (!html) {
    console.log('  Could not fetch roster page');

    return;
  }

  const $ = cheerio.load(html);
  const jerseyMap = parseRoster($);
  const teamDir = path.join(outputDir, slug);
  fs.mkdirSync(teamDir, { recursive: true });
  const outPath = path.join(teamDir, 'roster.json');

  if (Object.keys(jerseyMap).length === 0 && fs.existsSync(outPath)) {
    console.log(
      `  Roster parse returned 0 players, keeping existing ${outPath}`
    );

    return;
  }

  fs.writeFileSync(outPath, JSON.stringify(jerseyMap));
  console.log(`  Wrote ${outPath} (${Object.keys(jerseyMap).length} players)`);
}

// ── Per-team scraping ──

async function scrapeTeamBoxscores(
  slug: string,
  domain: string,
  year: number
): Promise<SerializedGameData[]> {
  const baseUrl = `https://${domain}`;
  console.log(`\n=== ${slug} / ${year} (${domain}) ===`);

  // 1. Fetch schedule page to get boxscore URLs
  console.log('  Fetching schedule page...');
  const scheduleHtml = await fetchPage(
    `${baseUrl}/sports/softball/schedule/${year}`
  );

  if (!scheduleHtml) {
    console.log(`  No schedule page for ${year}, skipping`);

    return [];
  }

  const $schedule = cheerio.load(scheduleHtml);
  const boxscoreUrls = extractBoxscoreUrls($schedule, baseUrl);
  console.log(`  Found ${boxscoreUrls.length} boxscore URLs`);

  if (boxscoreUrls.length === 0) {
    console.log(`  No boxscores for ${year}, skipping`);

    return [];
  }

  // 2. Auto-discover team name from the first boxscore
  console.log('  Discovering team name from first boxscore...');
  await delay(DELAY_MS);
  const firstHtml = await fetchPage(boxscoreUrls[0]);

  if (!firstHtml) {
    console.log('  Could not fetch first boxscore, skipping');

    return [];
  }

  const $first = cheerio.load(firstHtml);
  const teamName = discoverTeamName($first, domain);

  if (!teamName) {
    console.log('  Could not discover team name, skipping');

    return [];
  }

  console.log(`  Discovered team name: "${teamName}"`);

  // 3. Parse the first boxscore (already fetched)
  const gameDataList: SerializedGameData[] = [];
  const firstGame = extractGameData($first, boxscoreUrls[0], teamName);
  gameDataList.push(firstGame);
  console.log(
    `  Parsed boxscore 1/${boxscoreUrls.length}: ${firstGame.playByPlay.length} innings, ${firstGame.lineup.length} lineup slots`
  );

  // 4. Fetch remaining boxscores
  for (let i = 1; i < boxscoreUrls.length; i++) {
    const url = boxscoreUrls[i];
    console.log(`  Fetching boxscore ${i + 1}/${boxscoreUrls.length}: ${url}`);
    await delay(DELAY_MS);

    const html = await fetchPage(url);

    if (!html) {
      continue;
    }

    const $ = cheerio.load(html);
    const gameData = extractGameData($, url, teamName);
    gameDataList.push(gameData);
    console.log(
      `    ${gameData.playByPlay.length} innings, ${gameData.lineup.length} lineup slots`
    );
  }

  // Filter out games with no play-by-play data
  const validGames = gameDataList.filter((g) => g.playByPlay.length > 0);
  console.log(
    `  ${validGames.length}/${gameDataList.length} games have play-by-play data`
  );

  return validGames;
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

  console.log(`Scraping opponent boxscores for years: ${years.join(', ')}`);
  console.log(`Teams: ${Object.keys(teamsToScrape).join(', ')}`);
  console.log(`Output directory: ${outputDir}`);

  for (const [slug, domain] of Object.entries(teamsToScrape)) {
    await scrapeRoster(slug, domain, outputDir);
    await delay(DELAY_MS);

    for (const year of years) {
      const games = await scrapeTeamBoxscores(slug, domain, year);

      const teamDir = path.join(outputDir, slug);
      fs.mkdirSync(teamDir, { recursive: true });
      const filename =
        year === CURRENT_YEAR ? 'gamedata.json' : `gamedata-${year}.json`;
      const outPath = path.join(teamDir, filename);
      fs.writeFileSync(outPath, JSON.stringify(games));
      console.log(`  Wrote ${outPath} (${games.length} games)`);
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
