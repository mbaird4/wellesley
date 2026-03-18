---
paths:
  - 'src/app/**/*.{ts,html}'
  - 'libs/**/*.{ts,html}'
---

# Hard Rules (MUST follow — no exceptions)

These rules are non-negotiable. Violating any of them means the task is NOT complete.

## Component size limit

Components MUST NOT exceed ~300 lines of TypeScript. If a component grows beyond this, extract sub-components before continuing. Inline templates count toward the limit.

## No functions in templates

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

## Pipes for all formatting

NEVER use component methods or standalone functions (`fmtStat()`, `fmtIP()`, `toFixed()` wrappers) to format values for display. All formatting logic MUST live in shared pipes under `libs/shared/ui/src/lib/pipes/`. Label maps and lookup objects MUST be module-level constants, not declared inside functions.

## DRY: eliminate duplicated markup and logic

Before finishing any task, scan for duplicated code blocks:

- **Repeated HTML blocks** (same structure appearing 2+ times) MUST be extracted into either a reusable component or an `<ng-template>` with `@if`/`@for`.
- **Repeated TypeScript logic** (same pattern in 2+ places) MUST be extracted into a shared utility, pipe, or service.
- When you spot existing duplication while working nearby, flag it to the user (e.g., "I noticed these 3 components duplicate the stat-cell markup — want me to extract a shared component?").

## Host classes over wrapper divs

Apply layout/styling classes via the component's `host` metadata (e.g., `host: { class: 'flex justify-center items-center' }`) instead of adding wrapper `<div>` elements in templates. NEVER add a `<div>` solely for styling.

## No `[style]` bindings — use `[class]` with Tailwind

Avoid `[style]` and `[style.X]` bindings. Almost all styling MUST be done via `[class]` bindings or static Tailwind classes. The only acceptable exception is truly dynamic values that Tailwind cannot express (e.g., a calculated pixel offset or a data-driven color from an API). If you think you need `[style]`, first try to solve it with Tailwind classes and `[class]` toggling.

## Flex layouts and `gap` over margins

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

## Array methods over loops

NEVER use `for`, `for...in`, `for...of`, or `while` loops. Use array methods (`forEach`, `map`, `filter`, `reduce`, `find`, `some`, `every`, `flatMap`). Only exception: `for...of` when you genuinely need `break`/`continue` and `find`/`some` won't work.

## Separate HTML template files

Unless an Angular template is 1 line long, ALWAYS use a separate `.html` file with `templateUrl`. NEVER use inline `template` for multi-line templates.
