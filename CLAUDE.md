# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npx nx serve              # Dev server on :4200 (Vite + Tailwind watch)
npx nx build              # Production build → dist/wellesley/
npx nx test               # Jest unit tests
npx nx lint               # ESLint
```

Dev server proxies `/wellesleyblue/*` → `https://wellesleyblue.com` for CORS bypass (see `proxy.conf.json`). In production, `corsproxy.io` is used instead.

## Architecture

Angular 21 app that scrapes wellesleyblue.com boxscores to analyze Wellesley College softball statistics. Three-layer data flow:

1. **Data layer** (`src/app/softball-data.service.ts`) — Fetches boxscore HTML via Axios, parses with Cheerio, extracts lineup and play-by-play text. Caches in localStorage per year.
2. **Processing layer** (`src/lib/`) — Framework-agnostic pure functions that simulate games play-by-play, tracking base runners, outs, and plate appearances. Also usable from CLI (`src/cli.ts`).
3. **Display layer** (`src/app/` components) — Angular components consuming processed stats via `SoftballStatsService`.

### Core Processing Pipeline (`src/lib/`)

- **`parse-play.ts`** — `classifyPlay()` categorizes raw play text (PA, substitution, stolen base, wild pitch, tiebreaker, etc.). `parseBatterAction()` determines batter outcome. `parseRunnerSubEvent()` handles runner advances/scores. `processPlay()` mutates `GameState` (bases, outs, batterIndex).
- **`process-game-snapshots.ts`** — Wraps `processPlay()` to capture before/after `PlaySnapshot` for every play event. This is the main entry point for full game processing.
- **`process-games.ts`** — Aggregates snapshots across games into season-level stats (PA counts, scoring plays, sac bunt outcomes, base-runner situations).
- **`scoring-plays.ts`** — `extractScoringPlays()` detects runs from play text and state diffs. `computeSacBuntOutcomes()` tracks whether runners on base during sac bunts eventually scored.
- **`base-runner-stats.ts`** — Classifies base situations (8 types: empty through loaded) and counts PAs by (lineup slot, situation, outs).
- **`woba.ts`** — Weighted On-Base Average calculations with NCAA-appropriate linear weights.
- **`types.ts`** — All shared interfaces. Key types: `GameState`, `PlaySnapshot`, `ScoringPlay`, `BaseRunners`.

### Key Design Decisions

- `GameState.batterIndex` persists across innings (does NOT reset) — it cycles mod 9 to determine lineup slot.
- Play text parsing is regex-based against Sidearm Sports boxscore format (wellesleyblue.com). Boxscores use conventions like `"SAC, bunt"` for sac bunts but `"sacrifice fly"` for sac flies.
- Semicolons separate sub-events within a play: batter action first, then runner sub-events (e.g., `"K. Player singled to cf; M. Runner scored."`).
- `isPlateAppearance` on snapshots is critical — downstream consumers filter on it. Non-PA events (substitutions, tiebreakers, wild pitches) must NOT increment `batterIndex`.

## Code Style

- Apply layout/styling classes via the component's `host` metadata (e.g., `host: { class: 'flex justify-center items-center' }`) instead of adding wrapper `<div>` elements in templates. Avoid extra markup just for styling.

## Routes

- `/` — Lineup stats (PA by slot and out count)
- `/woba` — wOBA player rankings
- `/scoring` — Scoring play analysis

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Builds with `--base-href /wellesley/` and copies `index.html` → `404.html` for SPA routing.
