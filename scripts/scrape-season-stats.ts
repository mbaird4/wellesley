/**
 * Scrape full season stats (hitting, pitching, fielding) from a Sidearm Sports
 * stats page and output a single season-stats.json per team.
 *
 * Usage:
 *   npm run scrape-season-stats                          # all teams, current year
 *   npm run scrape-season-stats -- --team clark           # single team
 *   npm run scrape-season-stats -- --year 2026            # specific year
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ── Teams ──

interface TeamConfig {
  domain: string;
  /** Output subdirectory under public/data/opponents/ (defaults to slug) */
  outDir?: string;
  /** Sport slug in URL (defaults to 'softball') */
  sportSlug?: string;
}

const TEAMS: Record<string, TeamConfig> = {
  // NEWMAC
  wpi: { domain: 'athletics.wpi.edu' },
  wheaton: { domain: 'wheatoncollegelyons.com' },
  springfield: { domain: 'springfieldcollegepride.com' },
  smith: { domain: 'gosmithbears.com' },
  salve: { domain: 'salveathletics.com' },
  mit: { domain: 'mitathletics.com' },
  emerson: { domain: 'emersonlions.com' },
  coastguard: { domain: 'coastguardathletics.com' },
  clark: { domain: 'clarkathletics.com' },
  babson: { domain: 'babsonathletics.com' },
  // Florida trip opponents
  brockport: { domain: 'gobrockport.com', outDir: 'florida/brockport' },
  ecsu: { domain: 'gowarriorathletics.com', outDir: 'florida/ecsu' },
  macalester: {
    domain: 'athletics.macalester.edu',
    outDir: 'florida/macalester',
  },
  uwrf: { domain: 'uwrfsports.com', outDir: 'florida/uwrf' },
  uww: { domain: 'uwwsports.com', outDir: 'florida/uww' },
  wesleyan: { domain: 'athletics.wesleyan.edu', outDir: 'florida/wesleyan' },
  framingham: {
    domain: 'www.fsurams.com',
    outDir: 'florida/framingham',
    sportSlug: 'sball',
  },
  salemstate: {
    domain: 'salemstatevikings.com',
    outDir: 'florida/salemstate',
    sportSlug: 'sball',
  },
};

const HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

const DELAY_MS = 500;

// ── Utilities ──

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// ── Generic table helpers ──

function findTable(
  $: cheerio.CheerioAPI,
  captionMatch: string
): cheerio.Cheerio<any> | null {
  let found: cheerio.Cheerio<any> | null = null;

  $('table').each((_, table) => {
    const caption = $(table).find('caption').text();

    if (caption.includes(captionMatch)) {
      found = $(table);

      return false;
    }
  });

  return found;
}

function parsePlayerName(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<any>
): { name: string; jerseyNumber: number | null } | null {
  const nameCell = $row.find('th[scope="row"]');
  const name =
    nameCell.find('a.hide-on-medium-down').text().trim() ||
    nameCell.find('a').first().text().trim() ||
    nameCell.text().trim();

  if (!name) {
    return null;
  }

  // Jersey number is in a preceding td or in a mobile span
  const jerseyText =
    $row.find('td.text-center.hide-on-medium-down').first().text().trim() ||
    $row.find('.mobile-jersey-number').first().text().trim();
  const jerseyNumber = jerseyText ? parseInt(jerseyText, 10) : null;

  return {
    name,
    jerseyNumber:
      jerseyNumber !== null && !isNaN(jerseyNumber) ? jerseyNumber : null,
  };
}

function num($row: cheerio.Cheerio<any>, label: string): number {
  const cell = $row.find(`td[data-label="${label}"]`);

  return parseInt(cell.text().trim(), 10) || 0;
}

function pct($row: cheerio.Cheerio<any>, label: string): number {
  const cell = $row.find(`td[data-label="${label}"]`);

  return parseFloat(cell.text().trim()) || 0;
}

function parseDashPair(
  $row: cheerio.Cheerio<any>,
  label: string
): [number, number] {
  const text = $row.find(`td[data-label="${label}"]`).text().trim();
  const match = text.match(/^(\d+)-(\d+)$/);

  return match ? [parseInt(match[1], 10), parseInt(match[2], 10)] : [0, 0];
}

/** Extract row name from a tfoot row — handles both <th scope="row"> and plain <td> */
function tfootRowName(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<any>
): string {
  const thCell = $row.find('th[scope="row"]');

  if (thCell.length) {
    return (
      thCell.find('a').first().text().trim() || thCell.text().trim()
    ).toLowerCase();
  }

  // Fielding tfoot uses <td>Totals</td> instead of <th>
  let name = '';

  $row.find('td').each((_, td) => {
    const text = $(td).text().trim().toLowerCase();

    if (text === 'totals' || text === 'opponents') {
      name = text;

      return false;
    }
  });

  return name;
}

// ── Hitting ──

interface HittingRow {
  name: string;
  jerseyNumber: number | null;
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

function parseHittingRow(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<any>,
  nameOverride?: string
): Omit<HittingRow, 'name' | 'jerseyNumber'> & {
  name?: string;
  jerseyNumber?: number | null;
} {
  const [gp, gs] = parseDashPair($row, 'GP-GS');
  const [sb, sbAtt] = parseDashPair($row, 'SB');

  return {
    ...(nameOverride !== undefined ? { name: nameOverride } : {}),
    avg: pct($row, 'AVG'),
    ops: pct($row, 'OPS'),
    gp,
    gs,
    ab: num($row, 'AB'),
    r: num($row, 'R'),
    h: num($row, 'H'),
    doubles: num($row, '2B'),
    triples: num($row, '3B'),
    hr: num($row, 'HR'),
    rbi: num($row, 'RBI'),
    tb: num($row, 'TB'),
    slg: pct($row, 'SLG%'),
    bb: num($row, 'BB'),
    hbp: num($row, 'HBP'),
    so: num($row, 'SO'),
    gdp: num($row, 'GDP'),
    obp: pct($row, 'OB%'),
    sf: num($row, 'SF'),
    sh: num($row, 'SH'),
    sb,
    sbAtt,
  };
}

function parseHittingTable($: cheerio.CheerioAPI): {
  players: HittingRow[];
  totals: Omit<HittingRow, 'name' | 'jerseyNumber'> | null;
  opponents: Omit<HittingRow, 'name' | 'jerseyNumber'> | null;
} {
  const table = findTable($, 'Individual Overall Batting Statistics');

  if (!table) {
    return { players: [], totals: null, opponents: null };
  }

  const players: HittingRow[] = [];

  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const player = parsePlayerName($, $row);

    if (
      !player ||
      player.name.toLowerCase() === 'totals' ||
      player.name.toLowerCase() === 'opponents'
    ) {
      return;
    }

    players.push({
      ...player,
      ...parseHittingRow($, $row),
    } as HittingRow);
  });

  let totals: Omit<HittingRow, 'name' | 'jerseyNumber'> | null = null;
  let opponents: Omit<HittingRow, 'name' | 'jerseyNumber'> | null = null;

  table.find('tfoot tr').each((_, row) => {
    const $row = $(row);
    const name = tfootRowName($, $row);

    if (name === 'totals') {
      totals = parseHittingRow($, $row) as Omit<
        HittingRow,
        'name' | 'jerseyNumber'
      >;
    } else if (name === 'opponents') {
      opponents = parseHittingRow($, $row) as Omit<
        HittingRow,
        'name' | 'jerseyNumber'
      >;
    }
  });

  return { players, totals, opponents };
}

// ── Pitching ──

interface PitchingRow {
  name: string;
  jerseyNumber: number | null;
  era: number;
  whip: number;
  w: number;
  l: number;
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
  doubles: number;
  triples: number;
  hr: number;
  ab: number;
  bAvg: number;
  wp: number;
  hbp: number;
  bk: number;
  sfa: number;
  sha: number;
}

function parsePitchingRow(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<any>
): Omit<PitchingRow, 'name' | 'jerseyNumber'> {
  const [w, l] = parseDashPair($row, 'W-L');
  const [app, gs] = parseDashPair($row, 'APP-GS');
  const ipText = $row.find('td[data-label="IP"]').text().trim();

  return {
    era: pct($row, 'ERA'),
    whip: pct($row, 'WHIP'),
    w,
    l,
    app,
    gs,
    cg: num($row, 'CG'),
    sho: num($row, 'SHO'),
    sv: num($row, 'SV'),
    ip: parseFloat(ipText) || 0,
    h: num($row, 'H'),
    r: num($row, 'R'),
    er: num($row, 'ER'),
    bb: num($row, 'BB'),
    so: num($row, 'SO'),
    doubles: num($row, '2B'),
    triples: num($row, '3B'),
    hr: num($row, 'HR'),
    ab: num($row, 'AB'),
    bAvg: pct($row, 'B/AVG'),
    wp: num($row, 'WP'),
    hbp: num($row, 'HBP'),
    bk: num($row, 'BK'),
    sfa: num($row, 'SFA'),
    sha: num($row, 'SHA'),
  };
}

function parsePitchingTable($: cheerio.CheerioAPI): {
  players: PitchingRow[];
  totals: Omit<PitchingRow, 'name' | 'jerseyNumber'> | null;
  opponents: Omit<PitchingRow, 'name' | 'jerseyNumber'> | null;
} {
  const table = findTable($, 'Individual Overall Pitching Statistics');

  if (!table) {
    return { players: [], totals: null, opponents: null };
  }

  const players: PitchingRow[] = [];

  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const player = parsePlayerName($, $row);

    if (
      !player ||
      player.name.toLowerCase() === 'totals' ||
      player.name.toLowerCase() === 'opponents'
    ) {
      return;
    }

    players.push({
      ...player,
      ...parsePitchingRow($, $row),
    } as PitchingRow);
  });

  let totals: Omit<PitchingRow, 'name' | 'jerseyNumber'> | null = null;
  let opponents: Omit<PitchingRow, 'name' | 'jerseyNumber'> | null = null;

  table.find('tfoot tr').each((_, row) => {
    const $row = $(row);
    const name = tfootRowName($, $row);

    if (name === 'totals') {
      totals = parsePitchingRow($, $row);
    } else if (name === 'opponents') {
      opponents = parsePitchingRow($, $row);
    }
  });

  return { players, totals, opponents };
}

// ── Fielding ──

interface FieldingRow {
  name: string;
  jerseyNumber: number | null;
  tc: number;
  po: number;
  a: number;
  e: number;
  fldPct: number;
  dp: number;
  sba: number;
  csb: number;
  pb: number;
  ci: number;
}

function parseFieldingRow(
  $: cheerio.CheerioAPI,
  $row: cheerio.Cheerio<any>
): Omit<FieldingRow, 'name' | 'jerseyNumber'> {
  return {
    tc: num($row, 'TC'),
    po: num($row, 'PO'),
    a: num($row, 'A'),
    e: num($row, 'E'),
    fldPct: pct($row, 'FLD%'),
    dp: num($row, 'DP'),
    sba: num($row, 'SBA'),
    csb: num($row, 'CSB'),
    pb: num($row, 'PB'),
    ci: num($row, 'CI'),
  };
}

function parseFieldingTable($: cheerio.CheerioAPI): {
  players: FieldingRow[];
  totals: Omit<FieldingRow, 'name' | 'jerseyNumber'> | null;
  opponents: Omit<FieldingRow, 'name' | 'jerseyNumber'> | null;
} {
  const table = findTable($, 'Individual Overall Fielding Statistics');

  if (!table) {
    return { players: [], totals: null, opponents: null };
  }

  const players: FieldingRow[] = [];

  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const player = parsePlayerName($, $row);

    if (
      !player ||
      player.name.toLowerCase() === 'totals' ||
      player.name.toLowerCase() === 'opponents'
    ) {
      return;
    }

    players.push({
      ...player,
      ...parseFieldingRow($, $row),
    } as FieldingRow);
  });

  let totals: Omit<FieldingRow, 'name' | 'jerseyNumber'> | null = null;
  let opponents: Omit<FieldingRow, 'name' | 'jerseyNumber'> | null = null;

  table.find('tfoot tr').each((_, row) => {
    const $row = $(row);
    const name = tfootRowName($, $row);

    if (name === 'totals') {
      totals = parseFieldingRow($, $row);
    } else if (name === 'opponents') {
      opponents = parseFieldingRow($, $row);
    }
  });

  return { players, totals, opponents };
}

// ── CLI args ──

function parseTeamArg(): string | null {
  const idx = process.argv.indexOf('--team');

  if (idx === -1 || idx + 1 >= process.argv.length) {
    return null;
  }

  return process.argv[idx + 1].trim().toLowerCase();
}

function parseYearArg(): number {
  const idx = process.argv.indexOf('--year');

  if (idx === -1 || idx + 1 >= process.argv.length) {
    return new Date().getFullYear();
  }

  return parseInt(process.argv[idx + 1].trim(), 10);
}

// ── Main ──

async function main(): Promise<void> {
  const teamArg = parseTeamArg();
  const year = parseYearArg();

  if (teamArg && !TEAMS[teamArg]) {
    console.error(`Unknown team: ${teamArg}`);
    process.exit(1);
  }

  const teamsToScrape = teamArg ? { [teamArg]: TEAMS[teamArg] } : TEAMS;
  const outDir = path.resolve(__dirname, '../public/data/opponents');

  Object.entries(teamsToScrape).forEach(([slug, config]) => {
    const teamDir = path.join(outDir, config.outDir ?? slug);

    if (!fs.existsSync(teamDir)) {
      fs.mkdirSync(teamDir, { recursive: true });
    }
  });

  for (const [slug, config] of Object.entries(teamsToScrape)) {
    console.log(`\n── ${slug} (${year}) ──`);

    const sport = config.sportSlug ?? 'softball';
    const url = `https://${config.domain}/sports/${sport}/stats/${year}`;
    const html = await fetchPage(url);

    if (!html) {
      console.warn(`  No stats page found for ${slug} ${year}`);
      continue;
    }

    const $ = cheerio.load(html);
    const hitting = parseHittingTable($);
    const pitching = parsePitchingTable($);
    const fielding = parseFieldingTable($);

    console.log(
      `  Hitting: ${hitting.players.length} players, Pitching: ${pitching.players.length}, Fielding: ${fielding.players.length}`
    );

    const output = {
      slug,
      domain: config.domain,
      scrapedAt: new Date().toISOString(),
      year,
      hitting,
      pitching,
      fielding,
    };

    const teamDir = path.join(outDir, config.outDir ?? slug);
    const filename =
      year === new Date().getFullYear()
        ? 'season-stats.json'
        : `season-stats-${year}.json`;
    const filePath = path.join(teamDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`  Wrote ${filePath}`);

    await delay(DELAY_MS);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
