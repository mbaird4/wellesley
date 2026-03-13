/**
 * Determines the next non-conference opponent from the Wellesley schedule,
 * then scrapes that team's data (batting, pitching, gamedata, roster).
 *
 * Parses JSON-LD SportsEvent data from the schedule page to find upcoming
 * non-conference games. Delegates scraping to the appropriate existing
 * scraper (Sidearm or Presto) via child process.
 *
 * Usage:
 *   npm run scrape-next-opponent
 *   npm run scrape-next-opponent -- --years 2026,2025,2024,2023
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Non-conference team config ──

interface NonConferenceTeam {
  name: string;
  domain: string;
  site: 'sidearm' | 'presto';
  aliases: string[];
}

const NON_CONFERENCE_TEAMS: Record<string, NonConferenceTeam> = {
  nichols: {
    name: 'Nichols',
    domain: 'nicholsathletics.com',
    site: 'sidearm',
    aliases: ['Nichols', 'Nichols College'],
  },
  brandeis: {
    name: 'Brandeis',
    domain: 'brandeisjudges.com',
    site: 'sidearm',
    aliases: ['Brandeis', 'Brandeis University'],
  },
  endicott: {
    name: 'Endicott',
    domain: 'www.ecgulls.com',
    site: 'presto',
    aliases: ['Endicott', 'Endicott College'],
  },
  curry: {
    name: 'Curry',
    domain: 'www.curryathletics.com',
    site: 'presto',
    aliases: ['Curry', 'Curry College'],
  },
};

// ── Conference teams to exclude ──

const CONFERENCE_NAMES = ['babson', 'clark', 'coast guard', 'emerson', 'mit', 'salve regina', 'smith', 'springfield', 'wheaton', 'wpi', 'worcester polytechnic'];

// ── Constants ──

const BASE_URL = 'https://wellesleyblue.com';
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];
const OUTPUT_DIR = path.resolve(__dirname, '../public/data/opponents/next-opponent');

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// ── Types ──

interface ScheduleGame {
  opponent: string;
  date: string; // ISO date string (YYYY-MM-DD)
  isHome: boolean;
}

interface NextOpponentMeta {
  slug: string;
  name: string;
  domain: string;
  site: 'sidearm' | 'presto';
  gameDate: string;
  isHome: boolean;
  scrapedAt: string;
}

// ── Schedule parsing ──

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });

    return response.data;
  } catch {
    console.error(`  Failed to fetch: ${url}`);

    return null;
  }
}

function parseScheduleGames(html: string): ScheduleGame[] {
  const $ = cheerio.load(html);
  const games: ScheduleGame[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = JSON.parse($(el).html() || '');
      const events: unknown[] = Array.isArray(raw) ? raw : [raw];

      events.forEach((data: any) => {
        if (data['@type'] !== 'SportsEvent') {
          return;
        }

        const name: string = data.name || '';
        const startDate: string = data.startDate || '';
        const homeTeam: string = data.homeTeam?.name || '';
        const awayTeam: string = data.awayTeam?.name || '';

        if (!startDate || !name) {
          return;
        }

        // Determine opponent — use whichever team is NOT Wellesley
        // Sidearm always lists its own school as homeTeam regardless of venue
        const isHome = !name.toLowerCase().includes(' at ');
        const opponent = homeTeam.toLowerCase().includes('wellesley') ? awayTeam : homeTeam;

        if (!opponent || opponent.toLowerCase().includes('wellesley')) {
          return;
        }

        // Extract date (YYYY-MM-DD) from ISO datetime
        const date = startDate.split('T')[0];

        // Deduplicate doubleheaders (same opponent + same date)
        const existing = games.find((g) => g.opponent === opponent && g.date === date);

        if (!existing) {
          games.push({ opponent, date, isHome });
        }
      });
    } catch {
      // Skip malformed JSON-LD
    }
  });

  return games;
}

function matchNonConferenceTeam(opponentName: string): { slug: string; team: NonConferenceTeam } | null {
  const lower = opponentName.toLowerCase();

  for (const [slug, team] of Object.entries(NON_CONFERENCE_TEAMS)) {
    const matched = team.aliases.some((alias) => lower.includes(alias.toLowerCase()));

    if (matched) {
      return { slug, team };
    }
  }

  return null;
}

function isConferenceTeam(opponentName: string): boolean {
  const lower = opponentName.toLowerCase();

  return CONFERENCE_NAMES.some((name) => lower.includes(name));
}

function findNextNonConferenceGame(games: ScheduleGame[]): { game: ScheduleGame; slug: string; team: NonConferenceTeam } | null {
  const today = new Date().toISOString().split('T')[0];

  // Sort by date ascending
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));

  // Filter to non-conference games that match our known teams
  const nonConf = sorted
    .filter((g) => !isConferenceTeam(g.opponent))
    .map((g) => {
      const match = matchNonConferenceTeam(g.opponent);

      return match ? { game: g, slug: match.slug, team: match.team } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (nonConf.length === 0) {
    return null;
  }

  // Find the first game that hasn't been played yet (date >= today)
  const upcoming = nonConf.find((entry) => entry.game.date >= today);

  // If all games are done, return the last one
  return upcoming ?? nonConf[nonConf.length - 1];
}

// ── CLI arg parsing ──

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

// ── Main ──

async function main(): Promise<void> {
  const years = parseYearsArg();

  console.log('=== Next Non-Conference Opponent Scraper ===\n');

  // 1. Fetch and parse the schedule
  console.log(`Fetching schedule: ${BASE_URL}/sports/softball/schedule/${CURRENT_YEAR}`);
  const scheduleHtml = await fetchPage(`${BASE_URL}/sports/softball/schedule/${CURRENT_YEAR}`);

  if (!scheduleHtml) {
    console.error('Failed to fetch schedule page');
    process.exit(1);
  }

  const games = parseScheduleGames(scheduleHtml);
  console.log(`Found ${games.length} games on schedule`);

  // 2. Find the next non-conference opponent
  const result = findNextNonConferenceGame(games);

  if (!result) {
    console.log('No non-conference opponents found on schedule');
    process.exit(0);
  }

  const { game, slug, team } = result;
  console.log(`\nNext non-conference opponent: ${team.name}`);
  console.log(`  Game date: ${game.date}`);
  console.log(`  Location: ${game.isHome ? 'Home' : 'Away'}`);
  console.log(`  Site type: ${team.site}`);

  // 3. Write meta.json
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const meta: NextOpponentMeta = {
    slug,
    name: team.name,
    domain: team.domain,
    site: team.site,
    gameDate: game.date,
    isHome: game.isHome,
    scrapedAt: new Date().toISOString(),
  };

  const metaPath = path.join(OUTPUT_DIR, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`\nWrote ${metaPath}`);

  // 4. Scrape the opponent data using the appropriate scraper
  const yearsArg = years.join(',');

  if (team.site === 'sidearm') {
    console.log(`\nScraping ${team.name} via Sidearm scraper...`);
    const cmd = `npm run scrape-opponents -- --non-conference --team ${slug} --years ${yearsArg} --with-pitching --with-gamedata --output-dir ${OUTPUT_DIR}`;
    console.log(`  ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  } else {
    console.log(`\nScraping ${team.name} via Presto scraper...`);
    const cmd = `npm run scrape-ext -- --site presto --non-conference --team ${slug} --years ${yearsArg} --with-pitching --with-gamedata --output-dir ${OUTPUT_DIR}`;
    console.log(`  ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
