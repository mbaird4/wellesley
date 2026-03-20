/**
 * Checks the Wellesley schedule for tomorrow's game.
 * Outputs JSON to stdout: { opponent, slug, date, isHome } or empty object if no game.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/check-schedule.ts
 */

import { fetchPage, parseScheduleGames, type ScheduleGame } from './lib/schedule-parser';

// ── Slug lookup ──

// Maps opponent names (lowercased) to URL slugs.
// Conference + Florida teams use their own slug; non-conference teams use 'next-opponent'.
const OPPONENT_NAME_TO_SLUG: Record<string, string> = {
  // Conference (NEWMAC)
  babson: 'babson',
  'babson college': 'babson',
  clark: 'clark',
  'clark university': 'clark',
  'coast guard': 'coastguard',
  'united states coast guard academy': 'coastguard',
  emerson: 'emerson',
  'emerson college': 'emerson',
  mit: 'mit',
  'massachusetts institute of technology': 'mit',
  'salve regina': 'salve',
  smith: 'smith',
  'smith college': 'smith',
  springfield: 'springfield',
  'springfield college': 'springfield',
  wheaton: 'wheaton',
  'wheaton college mass': 'wheaton',
  'wheaton (mass.)': 'wheaton',
  wpi: 'wpi',
  'worcester polytechnic institute': 'wpi',
  // Florida trip
  'wesleyan conn': 'wesleyan',
  'wesleyan (conn.)': 'wesleyan',
  'uw-river falls': 'uwrf',
  'university of wisconsin river falls': 'uwrf',
  'suny brockport': 'brockport',
  macalester: 'macalester',
  'macalester college': 'macalester',
  'eastern connecticut': 'ecsu',
  'eastern connecticut state': 'ecsu',
  'wis whitewater': 'uww',
  'university of wisconsin whitewater': 'uww',
  'uw-whitewater': 'uww',
  'framingham st': 'framingham',
  'framingham state': 'framingham',
  'salem state': 'salemstate',
  // Non-conference (all map to next-opponent data dir)
  curry: 'next-opponent',
  'curry college': 'next-opponent',
  nichols: 'next-opponent',
  'nichols college': 'next-opponent',
  brandeis: 'next-opponent',
  'brandeis university': 'next-opponent',
  endicott: 'next-opponent',
  'endicott college': 'next-opponent',
};

function resolveSlug(opponentName: string): string | null {
  const lower = opponentName.toLowerCase().trim();

  // Exact match first
  if (OPPONENT_NAME_TO_SLUG[lower]) {
    return OPPONENT_NAME_TO_SLUG[lower];
  }

  // Partial match: check if any known name is contained in the opponent string
  const partial = Object.entries(OPPONENT_NAME_TO_SLUG).find(([name]) => lower.includes(name));

  return partial?.[1] ?? null;
}

function getTomorrowDateET(): string {
  // Get tomorrow in America/New_York timezone
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Advance to tomorrow
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return etFormatter.format(tomorrow); // YYYY-MM-DD
}

function findTomorrowsGame(games: ScheduleGame[]): ScheduleGame | null {
  const tomorrow = getTomorrowDateET();
  console.error(`Looking for games on: ${tomorrow}`);

  return games.find((g) => g.date === tomorrow) ?? null;
}

// ── Main ──

const BASE_URL = 'https://wellesleyblue.com';
const CURRENT_YEAR = new Date().getFullYear();

async function main(): Promise<void> {
  const scheduleUrl = `${BASE_URL}/sports/softball/schedule/${CURRENT_YEAR}`;
  console.error(`Fetching schedule: ${scheduleUrl}`);

  const html = await fetchPage(scheduleUrl);

  if (!html) {
    console.error('Failed to fetch schedule page');
    process.stdout.write('{}');
    process.exit(0);
  }

  const games = parseScheduleGames(html);
  console.error(`Found ${games.length} games on schedule`);

  const game = findTomorrowsGame(games);

  if (!game) {
    console.error('No game found for tomorrow');
    process.stdout.write('{}');
    process.exit(0);
  }

  const slug = resolveSlug(game.opponent);

  if (!slug) {
    console.error(`Unknown opponent: "${game.opponent}" — cannot resolve slug`);
    process.stdout.write('{}');
    process.exit(0);
  }

  console.error(`Tomorrow's game: ${game.opponent} (slug: ${slug})`);

  const result = JSON.stringify({
    opponent: game.opponent,
    slug,
    date: game.date,
    isHome: game.isHome,
  });

  process.stdout.write(result);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
