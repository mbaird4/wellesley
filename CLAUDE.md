# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npx nx serve              # Dev server on :4200 (Vite + Tailwind watch)
npx nx build              # Production build → dist/wellesley/
npx nx test               # Jest unit tests
npx nx lint               # ESLint
npm run format            # Prettier (run before lint)
npm run lint              # Prettier + ESLint fix (full pipeline)
```

In both dev and production, the app reads from pre-generated static JSON files (`public/data/`), refreshed by a daily cron job during season.

## Architecture

Angular 21 app that scrapes wellesleyblue.com boxscores to analyze Wellesley College softball statistics. Three-layer data flow:

1. **Data layer** (`src/app/softball-data.service.ts`) — Loads pre-generated static JSON game data from `public/data/`.
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

## Component Guidelines

- **Small, focused components** — Favor many small components over fewer large ones. Extract sub-sections into their own components early.
- **Signals over functions in templates** — Use Angular signals (`computed`, `signal`, `input`, `output`) for reactive state. Avoid calling functions directly in templates; derive values via `computed()` signals instead.
- **Pipes for value formatting** — Never use component methods to format/transform values in templates. Create shared pipes in `libs/shared/ui/src/lib/pipes/` instead. Label maps should be module-level constants, not declared inside functions.
- **Reusable presentational wrappers** — Build shared layout/presentational components (cards, panels, stat blocks) that accept content via projection or inputs. Keep them stateless and reusable across routes.
- **Mobile-first mindset** — Design components and layouts with mobile responsiveness in mind. Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) and avoid fixed-width layouts.
- **Components over repeated CSS** — Use Angular components for presentational patterns (badges, stat cells, cards) instead of repeating inline markup. Keep components stateless with inputs/outputs.
- **Nx libraries** — As the app grows, extract cohesive feature areas or shared UI into Nx libraries (e.g., `libs/ui`, `libs/stats-core`) to enforce boundaries and improve build times.

## Code Style

- Apply layout/styling classes via the component's `host` metadata (e.g., `host: { class: 'flex justify-center items-center' }`) instead of adding wrapper `<div>` elements in templates. Avoid extra markup just for styling.
- Prefer using tailwind classes over custom css. If scoping needed, create a \_partial.scss in `src/styles/` and `@forward` it into `src/_index.scss`, via a core mixin
- **Responsive branching** — Use `bp.gtSm()` (greater-than) as the primary `@if` check for desktop, with mobile as the `@else`. Think "is it desktop?" not "is it mobile?". Prefer `gt*` signals over `lt*`.
- **Responsive spacing utilities** — Use `p-section`, `p-card`, `p-cell` (and `px-`/`py-` variants) instead of writing manual responsive padding (`p-4 md:p-8`). These are defined in `tailwind.css` and scale automatically across breakpoints.
- Always use curly braces, even for single-line `if`/`else`/`for` bodies
- Always put `return` statements on their own line, even in single-line methods
- Blank line before methods in classes; no blank lines between properties
- Blank line before `return` statements
- Blank lines around block-like structures (`if`, `for`, `switch`, etc.)
- Always use array methods (`forEach`, `map`, `filter`, `reduce`, `find`, `some`, `every`, `flatMap`) over `for`/`for...in`/`for...of`/`while` loops
- Exceptions: `for...of` only when you need `break`/`continue` (but prefer `find`/`some` first)

## Routes

- `/` — Lineup stats (PA by slot and out count)
- `/woba` — wOBA player rankings
- `/scoring` — Scoring play analysis
- `/opponents` — Opponent scouting (historical batting stats)

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Builds with `--base-href /wellesley/` and copies `index.html` → `404.html` for SPA routing.
