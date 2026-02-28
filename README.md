# Wellesley Softball Stats

Angular app that scrapes [wellesleyblue.com](https://wellesleyblue.com) boxscores to analyze Wellesley College softball statistics. Also scrapes opponent team stats from Sidearm Sports sites across the NEWMAC conference.

Live at: [https://mbaird.github.io/wellesley/](https://mbaird.github.io/wellesley/)

## Prerequisites

- **Node.js** 20+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **npm** (comes with Node)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (runs on http://localhost:4200)
npx nx serve
```

The dev server proxies `/wellesleyblue/*` requests to `https://wellesleyblue.com` so boxscore scraping works locally without CORS issues (see `proxy.conf.json`). In production, the app reads from pre-generated static JSON files — it never scrapes live.

## Commands

| Command | What it does |
|---|---|
| `npx nx serve` | Dev server on `:4200` with hot reload |
| `npx nx build` | Production build to `dist/wellesley/` |
| `npx nx test` | Run Jest unit tests |
| `npx nx lint` | Run ESLint |
| `npm run prefetch` | Pre-scrape Wellesley boxscores to `public/data/` |
| `npm run scrape-opponents` | Scrape all 10 opponent teams' batting stats |
| `npm run scrape-opponents -- --team wpi` | Scrape a single team |
| `npm run scrape-opponents -- --years 2024,2025` | Override which years to scrape |

## Project Structure

```
src/
  app/                          # Angular components & services
    lineup-stats/               # / — PA counts by lineup slot and out count
    woba/                       # /woba — wOBA player rankings + team grid
    scoring-plays/              # /scoring — scoring play analysis
    opponents/                  # /opponents — opponent scouting (historical stats)
    softball-data.service.ts    # Fetches + parses boxscore HTML (Axios + Cheerio)
    softball-processor.service.ts
    softball-stats.service.ts
  lib/                          # Framework-agnostic pure functions
    parse-play.ts               # Classifies raw play text (PA, sub, stolen base, etc.)
    process-game-snapshots.ts   # Simulates games play-by-play, captures snapshots
    process-games.ts            # Aggregates snapshots into season-level stats
    scoring-plays.ts            # Detects runs from play text and state diffs
    base-runner-stats.ts        # PA counts by base situation (8 types) and outs
    woba.ts                     # wOBA calculation with NCAA linear weights
    types.ts                    # All shared interfaces
  cli.ts                        # CLI entry point for running processing outside Angular
scripts/
  prefetch-data.ts              # Pre-scrape Wellesley boxscores
  scrape-opponents.ts           # Scrape opponent batting stats from Sidearm Sports sites
public/
  data/opponents/               # Scraped opponent JSON files (checked in)
```

## How Data Flows

### Wellesley Stats

**Local dev:** `SoftballDataService` scrapes boxscore HTML live from wellesleyblue.com via the Vite proxy, parses it with Cheerio, and caches results in `localStorage`.

**Production:** The app loads pre-generated static JSON from `public/data/`. These files are created by `npm run prefetch` and checked into the repo. A GitHub Actions cron job (`.github/workflows/refresh-data.yml`) runs daily at 6 AM ET during softball season (Feb-May) to re-scrape the current year's data and auto-commit any changes.

**Processing pipeline (runs in-browser from the JSON):**

1. `parse-play.ts` classifies each play event (plate appearance, substitution, stolen base, wild pitch, etc.)
2. `process-game-snapshots.ts` simulates the game: tracks base runners, outs, and batter index through each play
3. Components consume the processed snapshots to show stats

### Opponent Stats (pre-scraped)

1. `npm run scrape-opponents` hits each opponent's Sidearm Sports site (`athletics.wpi.edu`, `mitathletics.com`, etc.)
2. For each team, it fetches the roster page + batting stats for 2023/2024/2025
3. Matches roster players to their stats by name, computes wOBA from counting stats
4. Writes JSON to `public/data/opponents/{slug}-historical-stats.json`
5. The Angular `OpponentsComponent` loads these static JSON files at runtime

**The 10 opponent teams:**

| Slug | Domain |
|---|---|
| wpi | athletics.wpi.edu |
| wheaton | wheatoncollegelyons.com |
| springfield | springfieldcollegepride.com |
| smith | gosmithbears.com |
| salve | salveathletics.com |
| mit | mitathletics.com |
| emerson | emersonlions.com |
| coastguard | coastguardathletics.com |
| clark | clarkathletics.com |
| babson | babsonathletics.com |

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Builds with `--base-href /wellesley/` and copies `index.html` to `404.html` for SPA routing.

## Key Technical Details

- **Play text parsing** is regex-based against the Sidearm Sports boxscore format. Semicolons separate sub-events within a play (batter action first, then runner advances).
- **`GameState.batterIndex`** persists across innings (does NOT reset) — it cycles mod 9 for lineup slot tracking.
- **wOBA weights** use NCAA-appropriate linear weights: BB/HBP=0.5, 1B=0.9, 2B=1.2, 3B=1.7, HR=2.5.
- The app is password-gated (SHA-256 hash check) to prevent casual public access.
