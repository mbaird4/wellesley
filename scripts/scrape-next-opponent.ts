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

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { fetchPage, parseScheduleGames, type ScheduleGame } from './lib/schedule-parser';

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

// ── Types ──

interface NextOpponentMeta {
  slug: string;
  name: string;
  domain: string;
  site: 'sidearm' | 'presto';
  gameDate: string;
  isHome: boolean;
  scrapedAt: string;
}

// ── Schedule helpers ──

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
  const cwd = path.resolve(__dirname, '..');

  if (team.site === 'sidearm') {
    console.log(`\nScraping ${team.name} via Sidearm scraper...`);
    const cmd = `npm run scrape-opponents -- --non-conference --team ${slug} --years ${yearsArg} --with-pitching --with-gamedata --output-dir ${OUTPUT_DIR}`;
    console.log(`  ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit', cwd });
  } else {
    console.log(`\nScraping ${team.name} via Presto scraper...`);
    const cmd = `npm run scrape-ext -- --site presto --non-conference --team ${slug} --years ${yearsArg} --with-pitching --with-gamedata --output-dir ${OUTPUT_DIR}`;
    console.log(`  ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit', cwd });
  }

  // 5. Scrape roster
  if (team.site === 'sidearm') {
    console.log(`\nScraping ${team.name} roster...`);
    const rosterCmd = `npm run scrape-opponents -- --non-conference --team ${slug} --roster-only --output-dir ${OUTPUT_DIR}`;
    console.log(`  ${rosterCmd}\n`);
    execSync(rosterCmd, { stdio: 'inherit', cwd });
  }

  // 6. Scrape season stats
  console.log(`\nScraping ${team.name} season stats...`);
  const seasonStatsCmd = `npm run scrape-season-stats -- --team ${slug} --domain ${team.domain} --output-dir ${OUTPUT_DIR}`;
  console.log(`  ${seasonStatsCmd}\n`);
  execSync(seasonStatsCmd, { stdio: 'inherit', cwd });

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
