# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard Rules (MUST follow — no exceptions)

These rules are non-negotiable. Violating any of them means the task is NOT complete.

### Component size limit

Components MUST NOT exceed ~150 lines of TypeScript. If a component grows beyond this, extract sub-components before continuing. Inline templates count toward the limit.

### No functions in templates

NEVER call functions directly in templates. Every derived value MUST use a `computed()` signal or a pipe.

BAD:

```html
<span>{{ formatStat(value) }}</span>
<td [class]="getColor(cell)"></td>
```

GOOD — computed signal:

```typescript
formattedStat = computed(() => this.value().toFixed(3));
```

```html
<span>{{ formattedStat() }}</span>
```

GOOD — pipe:

```html
<span>{{ value | formatStat }}</span>
```

### Pipes for all formatting

NEVER use component methods or standalone functions (`fmtStat()`, `fmtIP()`, `toFixed()` wrappers) to format values for display. All formatting logic MUST live in shared pipes under `libs/shared/ui/src/lib/pipes/`. Label maps and lookup objects MUST be module-level constants, not declared inside functions.

### DRY: eliminate duplicated markup and logic

Before finishing any task, scan for duplicated code blocks:

- **Repeated HTML blocks** (same structure appearing 2+ times) MUST be extracted into either a reusable component or an `<ng-template>` with `@if`/`@for`.
- **Repeated TypeScript logic** (same pattern in 2+ places) MUST be extracted into a shared utility, pipe, or service.
- When you spot existing duplication while working nearby, flag it to the user (e.g., "I noticed these 3 components duplicate the stat-cell markup — want me to extract a shared component?").

### Host classes over wrapper divs

Apply layout/styling classes via the component's `host` metadata (e.g., `host: { class: 'flex justify-center items-center' }`) instead of adding wrapper `<div>` elements in templates. NEVER add a `<div>` solely for styling.

### No `[style]` bindings — use `[class]` with Tailwind

Avoid `[style]` and `[style.X]` bindings. Almost all styling MUST be done via `[class]` bindings or static Tailwind classes. The only acceptable exception is truly dynamic values that Tailwind cannot express (e.g., a calculated pixel offset or a data-driven color from an API). If you think you need `[style]`, first try to solve it with Tailwind classes and `[class]` toggling.

### Flex layouts and `gap` over margins

ALWAYS use `flex` (or `grid`) layouts. NEVER use `block` or `inline`/`inline-block` for layout. Use `gap-*` on the flex/grid parent to space children — NEVER add margins (`m-*`, `mt-*`, `mb-*`, `ml-*`, `mr-*`) to children for spacing between siblings.

BAD:

```html
<div class="block">
  <span class="mb-2">First</span>
  <span class="mt-2">Second</span>
</div>
```

GOOD:

```html
<div class="flex flex-col gap-2">
  <span>First</span>
  <span>Second</span>
</div>
```

The only acceptable margin use is for asymmetric one-off offsets that `gap` can't express (e.g., a single element needing extra separation from the rest).

### Array methods over loops

NEVER use `for`, `for...in`, `for...of`, or `while` loops. Use array methods (`forEach`, `map`, `filter`, `reduce`, `find`, `some`, `every`, `flatMap`). Only exception: `for...of` when you genuinely need `break`/`continue` and `find`/`some` won't work.

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

- **Small, focused components** — Components MUST stay under ~150 lines. Extract sub-sections into their own components early and aggressively.
- **Signals over functions in templates** — Use Angular signals (`computed`, `signal`, `input`, `output`) for reactive state. NEVER call functions in templates; derive values via `computed()` signals instead.
- **Pipes for value formatting** — NEVER use component methods to format/transform values in templates. Create shared pipes in `libs/shared/ui/src/lib/pipes/` instead. Label maps MUST be module-level constants.
- **Reusable presentational wrappers** — Build shared layout/presentational components (cards, panels, stat blocks) that accept content via projection or inputs. Keep them stateless and reusable across routes.
- **Mobile-first mindset** — Design components and layouts with mobile responsiveness in mind. Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) and avoid fixed-width layouts.
- **Components over repeated markup** — Use Angular components or `<ng-template>` for presentational patterns (badges, stat cells, cards) instead of repeating inline markup. Keep components stateless with inputs/outputs.
- **Nx libraries** — As the app grows, extract cohesive feature areas or shared UI into Nx libraries (e.g., `libs/ui`, `libs/stats-core`) to enforce boundaries and improve build times.

## Code Style

- **Host classes** — Apply layout/styling via `host: { class: '...' }`. NEVER add wrapper `<div>`s just for styling.
- **Tailwind-first** — Prefer Tailwind classes over custom CSS. If scoping needed, create a \_partial.scss in `src/styles/` and `@forward` it into `src/_index.scss`, via a core mixin.
- **`[class]` over `[style]`** — Avoid `[style]` bindings. Use Tailwind classes and `[class]` toggling instead. Only use `[style]` for truly dynamic values Tailwind can't express.
- **Flex/grid + gap** — ALWAYS use `flex` or `grid` for layout, NEVER `block`/`inline`/`inline-block`. Space children with `gap-*` on the parent, not margins on the children.
- **Responsive branching** — Use `bp.gtSm()` (greater-than) as the primary `@if` check for desktop, with mobile as the `@else`. Think "is it desktop?" not "is it mobile?". Prefer `gt*` signals over `lt*`.
- **Responsive spacing utilities** — Use `p-section`, `p-card`, `p-cell` (and `px-`/`py-` variants) instead of writing manual responsive padding (`p-4 md:p-8`). These are defined in `tailwind.css` and scale automatically across breakpoints.
- Always use curly braces, even for single-line `if`/`else`/`for` bodies
- Always put `return` statements on their own line, even in single-line methods
- Blank line before methods in classes; no blank lines between properties
- Blank line before `return` statements
- Blank lines around block-like structures (`if`, `for`, `switch`, etc.)
- NEVER use `for`/`for...in`/`for...of`/`while` loops — use array methods

## Routes

- `/` — Lineup stats (PA by slot and out count)
- `/woba` — wOBA player rankings
- `/scoring` — Scoring play analysis
- `/opponents` — Opponent scouting (historical batting stats)

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Builds with `--base-href /wellesley/` and copies `index.html` → `404.html` for SPA routing.

## Pre-Completion Checklist

Before considering any task complete, run `npm run lint` (Prettier + ESLint) and verify ALL of the following:

1. [ ] No component exceeds ~150 lines — extract sub-components if needed
2. [ ] No functions called in templates — all derived values use `computed()` signals or pipes
3. [ ] No formatting logic in components — use shared pipes in `libs/shared/ui/src/lib/pipes/`
4. [ ] No duplicated HTML blocks — extract into components or `<ng-template>`
5. [ ] No duplicated TypeScript logic — extract into shared utilities
6. [ ] No `[style]` bindings — use `[class]` with Tailwind instead
7. [ ] All layouts use `flex` or `grid` — no `block`/`inline`/`inline-block`
8. [ ] Sibling spacing uses `gap-*` on parent — no margins on children for spacing
9. [ ] No manual responsive padding (`p-4 md:p-8`) — use `p-section`/`p-card`/`p-cell`
10. [ ] No wrapper `<div>`s for styling — use `host: { class: '...' }`
11. [ ] Responsive branching uses `@if (bp.gtSm())` as primary, mobile as `@else`
12. [ ] `npm run lint` passes (runs Prettier then ESLint)
