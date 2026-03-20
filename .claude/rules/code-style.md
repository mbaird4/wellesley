---
paths:
  - 'src/app/**/*.{ts,html,scss}'
  - 'libs/**/*.{ts,html,scss}'
---

# Component Guidelines

- **Small, focused components** — Components MUST stay under ~150 lines. Extract sub-sections into their own components early and aggressively.
- **Signals over functions in templates** — Use Angular signals (`computed`, `signal`, `input`, `output`) for reactive state. NEVER call functions in templates; derive values via `computed()` signals instead.
- **Pipes for value formatting** — NEVER use component methods to format/transform values in templates. Create shared pipes in `libs/shared/ui/src/lib/pipes/` instead. Label maps MUST be module-level constants.
- **Reusable presentational wrappers** — Build shared layout/presentational components (cards, panels, stat blocks) that accept content via projection or inputs. Keep them stateless and reusable across routes.
- **Mobile-first mindset** — Design components and layouts with mobile responsiveness in mind. Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) and avoid fixed-width layouts.
- **Components over repeated markup** — Use Angular components or `<ng-template>` for presentational patterns (badges, stat cells, cards) instead of repeating inline markup. Keep components stateless with inputs/outputs.
- **Nx libraries** — As the app grows, extract cohesive feature areas or shared UI into Nx libraries (e.g., `libs/ui`, `libs/stats-core`) to enforce boundaries and improve build times.

# Code Style

- **Tailwind-first** — Prefer Tailwind classes over custom CSS. If scoping needed, create a \_partial.scss in `src/styles/` and `@forward` it into `src/_index.scss`, via a core mixin.
- **`[class]` over `[style]`** — Avoid `[style]` bindings. Use Tailwind classes and `[class]` toggling instead. Only use `[style]` for truly dynamic values Tailwind can't express.
- **Flex/grid + gap** — ALWAYS use `flex` or `grid` for layout, NEVER `block`/`inline`/`inline-block`. Space children with `gap-*` on the parent, not margins on the children.
- **Responsive branching** — Use `bp.gtSm()` (greater-than) as the primary `@if` check for desktop, with mobile as the `@else`. Think "is it desktop?" not "is it mobile?". Prefer `gt*` signals over `lt*`.
- **Responsive spacing utilities** — Use `p-section`, `p-card`, `p-cell` (and `px-`/`py-` variants) instead of writing manual responsive padding (`p-4 md:p-8`). These are defined in `tailwind.css` and scale automatically across breakpoints.
