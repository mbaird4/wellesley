/**
 * Dumps per-player plate appearances for audit/debugging.
 *
 * Writes two JSON files per player into tmp/:
 *   - <name>-raw.json: raw play text grouped by game/inning, including
 *     surrounding plays in the same inning so you can see the context.
 *   - <name>-processed.json: the ClutchEvent records the pipeline produced
 *     for that batter, plus the isProductive classification.
 *
 * Usage:
 *   npm run dump-clutch-pas -- --players abernethy,claybrook
 *   npm run dump-clutch-pas                                # defaults below
 *
 * Or run directly:
 *   npx ts-node --project tsconfig.scripts.json scripts/dump-clutch-pas.ts
 */

import type { ClutchEvent, GameData } from '@ws/core/models';
import { isProductive, processGamesWithSnapshots } from '@ws/core/processors';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'public/data/gamedata.json');
const OUT_DIR = path.join(ROOT, 'tmp/clutch-audit');

function parseArgs(): string[] {
  const idx = process.argv.indexOf('--players');
  const next = idx >= 0 ? process.argv[idx + 1] : undefined;

  if (next) {
    return next.split(',').map((s) => s.trim().toLowerCase());
  }

  return ['abernethy', 'claybrook'];
}

interface RawPa {
  gameUrl: string | undefined;
  date: string | undefined;
  opponent: string | undefined;
  inning: string;
  paIndex: number;
  playText: string;
  inningContext: string[];
}

function dumpRaw(games: GameData[], lastNameLower: string): RawPa[] {
  const matches: RawPa[] = [];

  games.forEach((game) => {
    game.playByPlay.forEach((inn) => {
      inn.plays.forEach((play, idx) => {
        const lower = play.toLowerCase();

        if (!lower.includes(lastNameLower)) {
          return;
        }

        matches.push({
          gameUrl: game.url,
          date: game.date,
          opponent: game.opponent,
          inning: inn.inning,
          paIndex: idx,
          playText: play,
          inningContext: inn.plays,
        });
      });
    });
  });

  return matches;
}

function dumpProcessed(events: ClutchEvent[], lastNameLower: string): unknown[] {
  return events
    .filter((e) => e.batterName.toLowerCase().includes(lastNameLower))
    .map((e) => ({
      gameUrl: e.url,
      opponent: e.opponent,
      inning: e.inning,
      outsBefore: e.outsBefore,
      baseSituation: e.baseSituation,
      batterName: e.batterName,
      batterResult: e.batterResult,
      runnersOn: e.runnersOn,
      runnersScored: e.runnersScored,
      runnersAdvanced: e.runnersAdvanced,
      runnersStranded: e.runnersStranded,
      playText: e.playText,
      isProductive: isProductive(e),
    }));
}

function main(): void {
  const players = parseArgs();
  console.log(`Loading ${DATA_FILE}`);
  const games = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as GameData[];
  console.log(`Loaded ${games.length} games`);

  console.log('Running pipeline...');
  const processed = processGamesWithSnapshots(games);
  const allEvents = processed.clutchSummary?.allEvents ?? [];
  console.log(`Built ${allEvents.length} clutch events`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  players.forEach((name) => {
    const raw = dumpRaw(games, name);
    const proc = dumpProcessed(allEvents, name);

    const rawPath = path.join(OUT_DIR, `${name}-raw.json`);
    const procPath = path.join(OUT_DIR, `${name}-processed.json`);

    fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));
    fs.writeFileSync(procPath, JSON.stringify(proc, null, 2));

    const productiveCount = proc.filter((p) => (p as { isProductive: boolean }).isProductive).length;
    console.log(`${name}: ${raw.length} raw mentions, ${proc.length} processed PAs (${productiveCount} productive) → ${rawPath}, ${procPath}`);
  });
}

main();
