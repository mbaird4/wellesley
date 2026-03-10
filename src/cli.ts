/**
 * CLI entry point for running softball stats processing without Angular.
 *
 * Usage:
 *   npx ts-node src/cli.ts --year 2025
 */
import type { GameData, PlayByPlayInning } from '@ws/core/models';
import { processGames } from '@ws/core/processors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://wellesleyblue.com';

async function fetchBoxscoreUrls(year: number): Promise<string[]> {
  const url = `${BASE_URL}/sports/softball/schedule/${year}`;
  console.log(`Fetching schedule: ${url}`);
  const resp = await axios.get(url, {
    responseType: 'text',
    headers: { Accept: 'text/html' },
  });

  const $ = cheerio.load(resp.data);
  const urls: string[] = [];
  $('.sidearm-schedule-game-links-boxscore a').each((_i, el) => {
    const href = $(el).attr('href');
    if (href) {
      urls.push(href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`);
    }
  });

  const unique = [...new Set(urls)];
  console.log(`Found ${unique.length} unique boxscore URLs (${urls.length} total)`);

  return unique;
}

async function fetchGameData(boxscoreUrl: string): Promise<GameData> {
  const resp = await axios.get(boxscoreUrl, {
    responseType: 'text',
    headers: { Accept: 'text/html' },
  });

  const $ = cheerio.load(resp.data);
  const playByPlay = parsePlayByPlay($);

  return { lineup: new Map(), playByPlay };
}

function parsePlayByPlay($: cheerio.CheerioAPI): PlayByPlayInning[] {
  const innings: PlayByPlayInning[] = [];
  const pbpTab = $('#play-by-play');
  if (pbpTab.length === 0) {
    return innings;
  }

  const processed = new Set<string>();
  pbpTab.find('table').each((_tableIndex, table) => {
    const $table = $(table);
    const caption = $table.find('caption').text() || '';
    if (!caption.toLowerCase().includes('wellesley')) {
      return;
    }

    const inningKey = caption.replace(/Wellesley\s*-\s*(Top|Bottom)\s+of\s*/gi, '').trim();
    if (processed.has(inningKey)) {
      return;
    }

    processed.add(inningKey);

    const plays: string[] = [];
    $table.find('tbody tr').each((_rowIndex, row) => {
      const text = $(row).text().trim();
      const lower = text.toLowerCase();
      if (!text || lower.includes('play description') || text.length < 5 || lower.includes('inning summary') || /^\d+(st|nd|rd|th)\s+inning/i.test(lower)) {
        return;
      }

      plays.push(text);
    });

    if (plays.length > 0) {
      innings.push({ inning: inningKey, plays });
    }
  });

  return innings;
}

async function main() {
  const yearArg = process.argv.find((a) => a.startsWith('--year='));
  const yearFlag = process.argv.indexOf('--year');
  let year = 2025;
  if (yearArg) {
    year = parseInt(yearArg.split('=')[1], 10);
  } else if (yearFlag !== -1 && process.argv[yearFlag + 1]) {
    year = parseInt(process.argv[yearFlag + 1], 10);
  }

  console.log(`Processing softball stats for ${year}...\n`);

  const urls = await fetchBoxscoreUrls(year);
  const games: GameData[] = [];

  for (let i = 0; i < urls.length; i++) {
    console.log(`Fetching game ${i + 1}/${urls.length}: ${urls[i]}`);
    try {
      const game = await fetchGameData(urls[i]);
      if (game.playByPlay.length > 0) {
        games.push(game);
      }
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`\nProcessed ${games.length} games.\n`);

  const { totals } = processGames(games);

  console.log(`${'Slot'.padEnd(6) + '0-Out'.padEnd(8) + '1-Out'.padEnd(8) + '2-Out'.padEnd(8)}Total`);
  console.log('-'.repeat(35));
  totals.forEach((r) => {
    console.log(String(r.lineupSlot).padEnd(6) + String(r.paWith0Outs).padEnd(8) + String(r.paWith1Out).padEnd(8) + String(r.paWith2Outs).padEnd(8) + String(r.totalPA));
  });

  const totalPA = totals.reduce((s, r) => s + r.totalPA, 0);
  console.log('-'.repeat(35));
  console.log(`Total PAs: ${totalPA}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
