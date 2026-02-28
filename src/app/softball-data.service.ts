import { Injectable } from '@angular/core';
import { Observable, of, from, map, mergeMap, switchMap, catchError, throwError, toArray, tap } from 'rxjs';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface GameData {
  url?: string;
  opponent?: string;
  lineup: Map<number, string[]>; // slot -> array of normalized names
  playByPlay: PlayByPlayInning[];
}

export interface PlayByPlayInning {
  inning: string; // e.g., "1st", "2nd", etc.
  plays: string[]; // Array of play description texts
}

@Injectable({
  providedIn: 'root',
})
export class SoftballDataService {
  private readonly isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  /**
   * Returns cached GameData[] for a year, or fetches + caches if not present.
   * Priority: localStorage cache → static JSON (pre-fetched at build time) → live fetch.
   */
  getGameData(year: number): Observable<GameData[]> {
    const cached = this.loadFromCache(year);
    if (cached) {
      console.log(`[SoftballDataService] Cache hit for ${year}`);
      return of(cached);
    }
    return from(this.fetchStaticJson(year)).pipe(
      catchError(() => {
        console.log(`[SoftballDataService] Static JSON not available for ${year}, falling back to live fetch`);
        return this.fetchGameData(year).pipe(toArray());
      }),
      tap(games => this.saveToCache(year, games))
    );
  }

  private async fetchStaticJson(year: number): Promise<GameData[]> {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const url = `${base}data/gamedata-${year}.json`;
    console.log(`[SoftballDataService] Trying static JSON: ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json() as Array<{
      url?: string;
      opponent?: string;
      lineup: [number, string[]][];
      playByPlay: PlayByPlayInning[];
    }>;
    console.log(`[SoftballDataService] Loaded ${parsed.length} games from static JSON for ${year}`);
    return parsed.map(g => ({
      ...g,
      lineup: new Map(g.lineup),
    }));
  }

  clearCache(year?: number): void {
    if (year) {
      localStorage.removeItem(`wellesley-softball-${year}`);
    } else {
      // Clear all years
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('wellesley-softball-')) {
          localStorage.removeItem(key);
          i--; // adjust after removal
        }
      }
    }
  }

  private saveToCache(year: number, games: GameData[]): void {
    try {
      const serializable = games.map(g => ({
        ...g,
        lineup: Array.from(g.lineup.entries()),
      }));
      localStorage.setItem(`wellesley-softball-${year}`, JSON.stringify(serializable));
      console.log(`[SoftballDataService] Cached ${games.length} games for ${year}`);
    } catch (e) {
      console.warn('[SoftballDataService] Failed to cache data:', e);
    }
  }

  private loadFromCache(year: number): GameData[] | null {
    try {
      const raw = localStorage.getItem(`wellesley-softball-${year}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Array<{
        url?: string;
        opponent?: string;
        lineup: [number, string[]][];
        playByPlay: PlayByPlayInning[];
      }>;
      return parsed.map(g => ({
        ...g,
        lineup: new Map(g.lineup),
      }));
    } catch {
      return null;
    }
  }

  /**
   * Converts a wellesleyblue.com path or absolute URL to a fetchable URL.
   * In dev, uses the Vite proxy. In production, live fetch is only a fallback
   * (static JSON is the primary source), so we use the direct URL.
   */
  private getUrl(pathOrUrl: string): string {
    if (this.isLocal) {
      if (pathOrUrl.startsWith('http')) {
        return pathOrUrl.replace('https://wellesleyblue.com', '/wellesleyblue');
      }
      const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
      return `/wellesleyblue/${cleanPath}`;
    }
    // Production: direct URL (live fetch is a last resort; static JSON is preferred)
    if (pathOrUrl.startsWith('http')) return pathOrUrl;
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
    return `https://wellesleyblue.com/${cleanPath}`;
  }

  /**
   * Fetches the schedule page for a given year and extracts boxscore URLs
   */
  fetchBoxscoreUrls(year: number): Observable<string[]> {
    const scheduleUrl = this.getUrl(`sports/softball/schedule/${year}`);
    console.log('[SoftballDataService] Fetching schedule page with axios:', scheduleUrl);
    console.log('[SoftballDataService] isDevelopment:', this.isLocal);

    return from(
      axios.get(scheduleUrl, {
        responseType: 'text',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
    ).pipe(
      map((response) => {
        const html = response.data;
        console.log('[SoftballDataService] Received schedule HTML, length:', html.length);
        console.log('[SoftballDataService] HTML preview (first 500 chars):', html.substring(0, 500));
        
        // Check if we got the Angular app HTML instead of the actual page
        if (html.includes('<app-root>') || html.includes('@vite/client') || html.length < 1000) {
          console.error('[SoftballDataService] ERROR: Received Angular app HTML instead of schedule page!');
          throw new Error('Received Angular app HTML instead of schedule page');
        }
        
        const $ = cheerio.load(html);
        const urls = this.extractBoxscoreUrls($, scheduleUrl);
        console.log('[SoftballDataService] Extracted', urls.length, 'boxscore URLs');
        return urls;
      }),
      catchError((error) => {
        console.error('[SoftballDataService] Error fetching schedule:', error);
        if (error.response) {
          console.error('[SoftballDataService] HTTP Status:', error.response.status, error.response.statusText);
          console.error('[SoftballDataService] Response data preview:', error.response.data?.substring(0, 200));
        } else if (error.request) {
          console.error('[SoftballDataService] Request made but no response received');
        } else {
          console.error('[SoftballDataService] Error setting up request:', error.message);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Extracts boxscore URLs from the schedule page
   */
  private extractBoxscoreUrls($: cheerio.CheerioAPI, scheduleUrl: string): string[] {
    console.log('[SoftballDataService] Extracting boxscore URLs from schedule page');
    const urls: string[] = [];
    const boxscoreLinks = $('.sidearm-schedule-game-links-boxscore a');
    console.log('[SoftballDataService] Found', boxscoreLinks.length, 'boxscore link elements');

    // Log alternative selectors if the main one doesn't work
    if (boxscoreLinks.length === 0) {
      console.warn('[SoftballDataService] No boxscore links found with selector .sidearm-schedule-game-links-boxscore a');
      console.log('[SoftballDataService] Trying alternative selectors...');
      const altLinks = $('a[href*="boxscore"]');
      console.log('[SoftballDataService] Found', altLinks.length, 'links containing "boxscore"');
      const allLinks = $('a');
      console.log('[SoftballDataService] Total links on page:', allLinks.length);
    }

    boxscoreLinks.each((index, element) => {
      const href = $(element).attr('href');
      const linkText = $(element).text().trim();
      console.log(`[SoftballDataService] Link ${index + 1}: href="${href}", text="${linkText}"`);
      
      if (href) {
        const fullUrl = this.getUrl(href);
        console.log(`[SoftballDataService] Resolved URL ${index + 1}:`, fullUrl);
        urls.push(fullUrl);
      } else {
        console.warn(`[SoftballDataService] Link ${index + 1} has no href attribute`);
      }
    });

    // Deduplicate — the schedule page often has two boxscore links per game
    const unique = [...new Set(urls)];
    console.log('[SoftballDataService] Final URLs array:', unique.length, 'unique of', urls.length, 'total');
    return unique;
  }

  /**
   * Fetches and extracts raw game data for a given year
   * First fetches the schedule to get boxscore URLs, then fetches each boxscore
   * Returns structured data ready for processing (emits one GameData per URL)
   */
  fetchGameData(year: number): Observable<GameData> {
    console.log('[SoftballDataService] fetchGameData called for year:', year);
    return this.fetchBoxscoreUrls(year).pipe(
      switchMap((urls) => {
        console.log('[SoftballDataService] Got', urls.length, 'boxscore URLs to process');
        if (urls.length === 0) {
          console.warn('[SoftballDataService] No URLs to process, completing');
          return new Observable<GameData>((subscriber) => {
            subscriber.complete();
          });
        }

        return from(urls).pipe(
          mergeMap(
            (url, index) => {
              console.log(`[SoftballDataService] Fetching game ${index + 1}/${urls.length} with axios:`, url);
              return from(
                axios.get(url, {
                  responseType: 'text',
                  headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                  }
                })
              ).pipe(
                map((response) => {
                  const html = response.data;
                  console.log(`[SoftballDataService] Received HTML for game ${index + 1}, length:`, html.length);
                  console.log(`[SoftballDataService] HTML preview (first 500 chars):`, html.substring(0, 500));
                  
                  // Check if we got the Angular app HTML instead of the actual page
                  if (html.includes('<app-root>') || html.includes('@vite/client') || html.length < 1000) {
                    console.error(`[SoftballDataService] ERROR: Received Angular app HTML for game ${index + 1}!`);
                    throw new Error(`Received Angular app HTML for game URL: ${url}`);
                  }
                  
                  const $ = cheerio.load(html);
                  const gameData = this.extractGameData($, url, index + 1);
                  console.log(`[SoftballDataService] Extracted game data for game ${index + 1}:`, {
                    lineupSize: gameData.lineup.size,
                    playByPlayInnings: gameData.playByPlay.length
                  });
                  return gameData;
                }),
                catchError((error) => {
                  console.error(`[SoftballDataService] Error fetching game ${index + 1}:`, error);
                  if (error.response) {
                    console.error(`[SoftballDataService] HTTP Status:`, error.response.status, error.response.statusText);
                  } else if (error.request) {
                    console.error(`[SoftballDataService] Request made but no response received`);
                  } else {
                    console.error(`[SoftballDataService] Error:`, error.message);
                  }
                  return throwError(() => error);
                })
              );
            },
            1 // Process one URL at a time
          )
        );
      })
    );
  }

  /**
   * Extracts lineup and play-by-play data from a parsed DOM document
   */
  private extractGameData($: cheerio.CheerioAPI, url: string, gameIndex: number): GameData {
    console.log(`[SoftballDataService] Extracting game data for game ${gameIndex} from:`, url);
    const lineup = this.parseLineup($, gameIndex);
    const playByPlay = this.parsePlayByPlay($, gameIndex);

    console.log(`[SoftballDataService] Game ${gameIndex} extraction complete:`, {
      lineupEntries: lineup.size,
      playByPlayInnings: playByPlay.length
    });

    // Extract opponent name from URL slug
    const opponentMatch = url.match(/stats\/\d{4}\/([^/]+)\//);
    const opponent = opponentMatch
      ? opponentMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Unknown';

    return {
      url,
      opponent,
      lineup,
      playByPlay,
    };
  }

  /**
   * Parses the lineup table from the DOM
   */
  private parseLineup($: cheerio.CheerioAPI, gameIndex: number): Map<number, string[]> {
    console.log(`[SoftballDataService] Parsing lineup for game ${gameIndex}`);
    const lineup = new Map<number, string[]>();
    const tables = $('table');
    console.log(`[SoftballDataService] Found ${tables.length} tables on page`);

    let wellesleyTableCount = 0;
    tables.each((tableIndex, table) => {
      const $table = $(table);
      const header = $table.find('caption').text() || '';
      const hasWellesley = header.includes('Wellesley');
      
      console.log(`[SoftballDataService] Table ${tableIndex + 1} caption: "${header}", hasWellesley: ${hasWellesley}`);

      if (hasWellesley) {
        wellesleyTableCount++;
        console.log(`[SoftballDataService] Processing Wellesley table ${wellesleyTableCount}`);
        let slot = 1;
        const rows = $table.find('tbody tr');
        console.log(`[SoftballDataService] Found ${rows.length} rows in Wellesley table`);

        rows.each((rowIndex, row) => {
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

          const playerName = this.extractPlayerName(playerText);
          if (playerName) {
            const normalized = this.normalizeName(playerName);
            console.log(`[SoftballDataService] Row ${rowIndex + 1}: player="${playerName}", normalized="${normalized}", isSubstitution=${isSubstitution}, slot=${slot}`);

            if (isSubstitution) {
              const previousSlot = slot - 1;
              if (previousSlot > 0) {
                const existingNames = lineup.get(previousSlot) || [];
                existingNames.push(normalized);
                lineup.set(previousSlot, existingNames);
                console.log(`[SoftballDataService] Added substitution to slot ${previousSlot}`);
              }
            } else {
              lineup.set(slot, [normalized]);
              slot += 1;
            }
          } else {
            console.log(`[SoftballDataService] Row ${rowIndex + 1}: No player name extracted from "${playerText}"`);
          }
        });
      }
    });

    console.log(`[SoftballDataService] Lineup parsing complete: ${lineup.size} slots filled, ${wellesleyTableCount} Wellesley tables processed`);
    return lineup;
  }

  /**
   * Parses play-by-play data from the DOM
   */
  private parsePlayByPlay($: cheerio.CheerioAPI, gameIndex: number): PlayByPlayInning[] {
    console.log(`[SoftballDataService] Parsing play-by-play for game ${gameIndex}`);
    const innings: PlayByPlayInning[] = [];
    const pbpTab = $('#play-by-play');
    console.log(`[SoftballDataService] Play-by-play tab found: ${pbpTab.length > 0}`);
    
    if (pbpTab.length === 0) {
      console.warn(`[SoftballDataService] No play-by-play tab found (id="play-by-play")`);
      // Try alternative selectors
      const altPbp = $('[id*="play"]');
      console.log(`[SoftballDataService] Found ${altPbp.length} elements with "play" in id`);
      return innings;
    }

    const pbpTables = pbpTab.find('table');
    console.log(`[SoftballDataService] Found ${pbpTables.length} tables in play-by-play tab`);
    const processedInnings = new Set<string>();

    pbpTables.each((tableIndex, table) => {
      const $table = $(table);
      const caption = $table.find('caption').text() || '';
      console.log(`[SoftballDataService] PBP Table ${tableIndex + 1} caption: "${caption}"`);

      if (!caption.toLowerCase().includes('wellesley')) {
        console.log(`[SoftballDataService] Skipping table ${tableIndex + 1} (doesn't contain "wellesley")`);
        return;
      }

      const inningKey = caption
        .replace(/Wellesley\s*-\s*(Top|Bottom)\s+of\s*/gi, '')
        .trim();

      if (processedInnings.has(inningKey)) {
        console.log(`[SoftballDataService] Skipping duplicate inning: ${inningKey}`);
        return;
      }

      processedInnings.add(inningKey);
      console.log(`[SoftballDataService] Processing inning: ${inningKey}`);

      const plays: string[] = [];
      const rows = $table.find('tbody tr');
      console.log(`[SoftballDataService] Found ${rows.length} rows in inning ${inningKey}`);

      rows.each((rowIndex, row) => {
        const $row = $(row);
        // Grab only the first cell (play description), not the score columns
        const firstCell = $row.find('td').first();
        const originalText = (firstCell.length ? firstCell.text() : $row.text()).trim() || '';
        const text = originalText.toLowerCase();

        if (
          !originalText ||
          text.includes('play description') ||
          text.length < 5
        ) {
          return;
        }

        // Skip inning summary headers
        if (
          text.includes('inning summary') ||
          text.match(/^\d+(st|nd|rd|th)\s+inning/i)
        ) {
          return;
        }

        plays.push(originalText);
      });

      console.log(`[SoftballDataService] Inning ${inningKey}: ${plays.length} plays extracted`);
      if (plays.length > 0) {
        innings.push({
          inning: inningKey,
          plays,
        });
      }
    });

    console.log(`[SoftballDataService] Play-by-play parsing complete: ${innings.length} innings found`);
    return innings;
  }

  /**
   * Normalizes player names for consistent matching
   */
  private normalizeName(name: string): string {
    return name.replace(/\./g, '').trim().toLowerCase();
  }

  /**
   * Extracts player name from cell text, removing position prefix
   */
  private extractPlayerName(cellText: string): string {
    const match = cellText.match(/^[a-z\/]+ (.+)$/i);
    if (match) {
      return match[1].trim();
    }
    return cellText.trim();
  }
}
