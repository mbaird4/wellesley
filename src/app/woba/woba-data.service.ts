import { inject, Injectable } from '@angular/core';
import { Observable, of, from, map, switchMap, mergeMap, toArray, tap, catchError, throwError } from 'rxjs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SoftballDataService } from '../softball-data.service';
import {
  PlayerSeasonStats,
  PlayerGameStats,
  BoxscoreData,
  WobaSeasonData,
} from '../../lib/types';

@Injectable({
  providedIn: 'root',
})
export class WobaDataService {
  private readonly dataService = inject(SoftballDataService);

  private readonly isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  private readonly baseUrl = this.isLocal ? '/wellesleyblue' : 'https://wellesleyblue.com';

  /**
   * Returns wOBA season data for a year.
   * Priority: localStorage cache → static JSON (pre-fetched at build time) → live fetch.
   */
  getSeasonData(year: number): Observable<WobaSeasonData> {
    const cached = this.loadFromCache(year);
    if (cached) {
      console.log(`[WobaDataService] Cache hit for ${year}`);
      return of(cached);
    }

    return from(this.fetchStaticJson(year)).pipe(
      catchError(() => {
        console.log(`[WobaDataService] Static JSON not available for ${year}, falling back to live fetch`);
        return this.fetchStatsPage(year).pipe(
          switchMap((seasonStats) =>
            this.fetchBoxscoreStats(year).pipe(
              map((boxscores) => ({ seasonStats, boxscores }))
            )
          ),
        );
      }),
      tap((data) => this.saveToCache(year, data))
    );
  }

  private async fetchStaticJson(year: number): Promise<WobaSeasonData> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const url = `${base}data/wobadata-${year}.json`;
    console.log(`[WobaDataService] Trying static JSON: ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as WobaSeasonData;
    console.log(`[WobaDataService] Loaded wOBA data from static JSON for ${year}`);
    return data;
  }

  clearCache(year?: number): void {
    if (year) {
      localStorage.removeItem(`wellesley-woba-${year}`);
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('wellesley-woba-')) {
          localStorage.removeItem(key);
          i--;
        }
      }
    }
  }

  private saveToCache(year: number, data: WobaSeasonData): void {
    try {
      localStorage.setItem(`wellesley-woba-${year}`, JSON.stringify(data));
      console.log(`[WobaDataService] Cached wOBA data for ${year}`);
    } catch (e) {
      console.warn('[WobaDataService] Failed to cache data:', e);
    }
  }

  private loadFromCache(year: number): WobaSeasonData | null {
    try {
      const raw = localStorage.getItem(`wellesley-woba-${year}`);
      if (!raw) return null;
      return JSON.parse(raw) as WobaSeasonData;
    } catch {
      return null;
    }
  }

  private getUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${this.baseUrl}/${cleanPath}`;
  }

  fetchStatsPage(year: number): Observable<PlayerSeasonStats[]> {
    const url = this.getUrl(`sports/softball/stats/${year}`);
    console.log('[WobaDataService] Fetching stats page:', url);

    return from(
      axios.get(url, {
        responseType: 'text',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      })
    ).pipe(
      map((response) => {
        const html = response.data;
        if (html.includes('<app-root>') || html.length < 1000) {
          throw new Error('Received Angular app HTML instead of stats page');
        }
        const $ = cheerio.load(html);
        return this.parseStatsTable($);
      }),
      catchError((error) => {
        console.error('[WobaDataService] Error fetching stats page:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Stats page table structure:
   *   <tr>
   *     <td>#</td>
   *     <th scope="row"><a class="hide-on-medium-down">Name, First</a>...</th>
   *     <td data-label="AVG">...</td>
   *     <td data-label="AB">...</td>
   *     ... etc
   *   </tr>
   * Use data-label attributes to find column values reliably.
   */
  private parseStatsTable($: cheerio.CheerioAPI): PlayerSeasonStats[] {
    const players: PlayerSeasonStats[] = [];

    let targetTable: ReturnType<cheerio.CheerioAPI> | null = null;
    $('table').each((_, table) => {
      const caption = $(table).find('caption').text();
      if (caption.includes('Individual Overall Batting Statistics')) {
        targetTable = $(table);
        return false;
      }
    });

    if (!targetTable) {
      console.warn('[WobaDataService] Could not find Individual Overall Batting Statistics table');
      return players;
    }

    targetTable!.find('tbody tr').each((_, row) => {
      const $row = $(row);

      // Player name is in a <th> with scope="row", containing an <a> link
      const nameCell = $row.find('th[scope="row"]');
      const name = nameCell.find('a.hide-on-medium-down').text().trim()
        || nameCell.find('a').first().text().trim()
        || nameCell.text().trim();

      if (!name || name.toLowerCase() === 'totals' || name.toLowerCase() === 'opponents') return;

      // Use data-label attributes to get correct values
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

    console.log(`[WobaDataService] Parsed ${players.length} players from stats table`);
    return players;
  }

  fetchBoxscoreStats(year: number): Observable<BoxscoreData[]> {
    return this.dataService.fetchBoxscoreUrls(year).pipe(
      switchMap((urls) => {
        console.log(`[WobaDataService] Fetching ${urls.length} boxscores for wOBA`);
        if (urls.length === 0) return of([]);

        return from(urls).pipe(
          mergeMap(
            (url) =>
              from(
                axios.get(url, {
                  responseType: 'text',
                  headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                  },
                })
              ).pipe(
                map((response) => {
                  const html = response.data;
                  if (html.includes('<app-root>') || html.length < 1000) {
                    throw new Error(`Received Angular app HTML for boxscore: ${url}`);
                  }
                  const $ = cheerio.load(html);
                  return this.parseBoxscore($, url);
                }),
                catchError((error) => {
                  console.error(`[WobaDataService] Error fetching boxscore ${url}:`, error.message);
                  return of(null);
                })
              ),
            1
          ),
          toArray(),
          map((results) => results.filter((r): r is BoxscoreData => r !== null))
        );
      })
    );
  }

  /**
   * Boxscore batting table structure:
   *   <caption>Wellesley 2</caption>
   *   <tr>
   *     <td>lf</td>
   *     <td><a class="boxscore_player_link">Mulhern, Alena</a></td>
   *     <td data-label="AB">2</td>
   *     <td data-label="R">0</td>
   *     <td data-label="H">1</td>
   *     <td data-label="RBI">1</td>
   *     <td data-label="BB">0</td>
   *     <td data-label="SO">1</td>
   *     <td data-label="LOB">0</td>
   *   </tr>
   *
   * Supplementary stats are in <dt>/<dd> pairs:
   *   <dt>2B:</dt><dd><a class="boxscore_player_link">Jones, Giana</a> (1)</dd>
   *   <dt>SF:</dt><dd><a class="boxscore_player_link">Mulhern, Alena</a> (1)</dd>
   *
   * HBP is in a flat <td>:
   *   <td>HBP: None</td>  or  <td>HBP: Player Name (count)</td>
   */
  private parseBoxscore($: cheerio.CheerioAPI, url: string): BoxscoreData {
    const { date, opponent } = this.parseGameInfo($, url);

    const playerStats: PlayerGameStats[] = [];
    const playerMap = new Map<string, PlayerGameStats>();

    // Find the Wellesley batting table — caption contains "Wellesley" and a score number,
    // but NOT "Pitching Stats" and NOT play-by-play inning captions (those have "Top/Bottom")
    let wellesleyTable: ReturnType<cheerio.CheerioAPI> | null = null;
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
      console.warn(`[WobaDataService] No Wellesley batting table found in ${url}`);
      return { date, opponent, url, playerStats };
    }

    wellesleyTable!.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length < 3) return;

      // Player name: find the .boxscore_player_link <a> in the row
      const playerLink = $row.find('.boxscore_player_link');
      const name = playerLink.text().trim();
      if (!name) return;

      // Use data-label attributes for reliable column lookup
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

      playerMap.set(this.normalizeName(name), stats);
      playerStats.push(stats);
    });

    // Parse supplementary stats from <dt>/<dd> pairs and HBP from flat text
    this.parseSupplementaryStats($, playerMap);

    return { date, opponent, url, playerStats };
  }

  private parseGameInfo($: cheerio.CheerioAPI, url: string): { date: string; opponent: string } {
    // Date is in a <dt>Date</dt><dd>3/17/2025</dd> pair
    let date = '';
    $('dt').each((_, el) => {
      if ($(el).text().trim() === 'Date') {
        date = $(el).next('dd').text().trim();
        return false;
      }
    });

    if (!date) {
      // Fallback: page title often has "on M/D/YYYY"
      const title = $('title').text();
      const titleMatch = title.match(/on (\d{1,2}\/\d{1,2}\/\d{4})/);
      if (titleMatch) date = titleMatch[1];
    }

    // Extract opponent from URL slug
    const opponentMatch = url.match(/stats\/\d{4}\/([^/]+)\//);
    const opponent = opponentMatch
      ? opponentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Unknown';

    return { date, opponent };
  }

  /**
   * Supplementary stats come in two formats:
   *
   * 1. <dt>/<dd> pairs under "Batting" sections (for 2B, 3B, HR, SF, SH):
   *    <dt>2B:</dt><dd><a class="boxscore_player_link">Jones, Giana</a> (1)</dd>
   *    <dt>SF:</dt><dd>Mulhern, Alena (1); Smith, Jane (2)</dd>
   *
   * 2. Flat <td> text for HBP (appears after pitching tables):
   *    <td>HBP: None</td>
   *    <td>HBP: Player Name (1)</td>
   *
   * Both opponent and Wellesley sections exist — we match against our playerMap
   * so opponent attributions are harmlessly ignored.
   */
  private parseSupplementaryStats(
    $: cheerio.CheerioAPI,
    playerMap: Map<string, PlayerGameStats>
  ): void {
    // Parse <dt>/<dd> pairs for 2B, 3B, HR, SF, SH
    const dtDdStats: Array<{ label: string; field: keyof Pick<PlayerGameStats, 'doubles' | 'triples' | 'hr' | 'sf' | 'sh'> }> = [
      { label: '2B:', field: 'doubles' },
      { label: '3B:', field: 'triples' },
      { label: 'HR:', field: 'hr' },
      { label: 'SF:', field: 'sf' },
      { label: 'SH:', field: 'sh' },
    ];

    for (const { label, field } of dtDdStats) {
      $('dt').each((_, dt) => {
        if ($(dt).text().trim() !== label) return;
        const dd = $(dt).next('dd');
        const ddText = dd.text().trim();
        if (!ddText || ddText.toLowerCase() === 'none') return;

        this.attributeStatToPlayers(ddText, playerMap, field);
      });
    }

    // Parse HBP from flat <td> text: "HBP: Player Name (1)" or "HBP: None"
    $('td').each((_, td) => {
      const text = $(td).text().trim();
      const hbpMatch = text.match(/^HBP:\s*(.+)$/i);
      if (!hbpMatch) return;
      const line = hbpMatch[1].trim();
      if (line.toLowerCase() === 'none') return;

      this.attributeStatToPlayers(line, playerMap, 'hbp');
    });
  }

  private attributeStatToPlayers(
    text: string,
    playerMap: Map<string, PlayerGameStats>,
    field: keyof Pick<PlayerGameStats, 'doubles' | 'triples' | 'hr' | 'hbp' | 'sf' | 'sh'>
  ): void {
    // Parse "LastName, FirstName (count)" or "LastName, FirstName (count); AnotherPlayer (count)"
    const playerRegex = /([\w][\w\s,.'"-]+?)\s*\((\d+)\)/g;
    let match;
    while ((match = playerRegex.exec(text)) !== null) {
      const playerName = match[1].trim();
      const count = parseInt(match[2], 10);
      const normalized = this.normalizeName(playerName);

      const stats = playerMap.get(normalized);
      if (stats) {
        stats[field] = count;
      } else {
        // Fuzzy match by last name
        for (const [key, s] of playerMap.entries()) {
          if (this.lastNameMatch(key, normalized)) {
            s[field] = count;
            break;
          }
        }
      }
    }
  }

  private lastNameMatch(a: string, b: string): boolean {
    const lastA = a.split(',')[0].trim();
    const lastB = b.split(',')[0].trim();
    return lastA.length > 2 && lastA === lastB;
  }

  private normalizeName(name: string): string {
    return name.replace(/\./g, '').trim().toLowerCase();
  }
}
