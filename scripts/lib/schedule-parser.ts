import axios from 'axios';
import * as cheerio from 'cheerio';

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

export interface ScheduleGame {
  opponent: string;
  date: string; // YYYY-MM-DD
  isHome: boolean;
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });

    return response.data;
  } catch {
    console.error(`  Failed to fetch: ${url}`);

    return null;
  }
}

export function parseScheduleGames(html: string): ScheduleGame[] {
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
