---
paths:
  - 'src/**/*.{ts,html,scss,css}'
  - 'libs/**/*.{ts,html,scss,css}'
---

# Frontend Aesthetics

Claude tends toward safe, generic UI choices. These rules push for clean, minimal designs with subtle polish and a dash of whimsy — appropriate for a data-heavy dark-themed sports analytics app.

## Typography

The app currently uses Inter — swap it out. Pick distinctive, readable fonts from Google Fonts.

**Good fits for this app (readable + character):**

- Plus Jakarta Sans, DM Sans, Outfit, Lexend — geometric, warm, great for data
- IBM Plex Sans, Source Sans 3 — technical, clean, slightly more personality
- Bricolage Grotesque, Newsreader — when a section needs extra whimsy

**Pairing principle:** High contrast is interesting. A geometric sans for body + a monospace or display font for headings/stat values. Use weight extremes (300 vs 700+, not 400 vs 600). Size jumps of 3x+ create visual hierarchy.

**Never use:** Inter, Roboto, Open Sans, Lato, Arial, or system font stacks as the primary font.

## Color & Theme

The dark theme and brand color system (`tailwind.css`) is established — build on it, don't reinvent it.

- Use the existing color tokens (`surface-*`, `content-*`, `brand-*`, `tier-*`). Don't introduce one-off hex values.
- Dominant color + sharp accent > timid, evenly-distributed palettes. The brand blue should pop against the dark surface, not blend in.
- When adding new UI elements, check if an existing token fits before proposing a new one.

## Motion & Micro-interactions

Subtle, purposeful animation adds life without cluttering a data-dense app. Use CSS transitions and Angular animations.

- **High-impact moments:** A single well-orchestrated page load with staggered reveals (`animation-delay`) creates more delight than scattered hover effects.
- **Transitions on state change:** Smooth `opacity`, `transform`, and `background` transitions when data loads, tabs switch, or cards expand/collapse.
- **Hover states with intent:** Slight lifts (`-translate-y-px`), glows, or color shifts on interactive elements. Already established in `tailwind.css` — be consistent with those patterns.
- **Don't overdo it.** This is a stats tool. Animations should feel snappy (150-300ms), not sluggish. No bouncing, no parallax, no decorative loaders.

## Backgrounds & Depth

- Layer subtle gradients or noise textures for atmosphere — avoid flat solid backgrounds for large sections.
- Use `backdrop-filter: blur()` (already on `.stats-section`) to create depth between layers.
- Subtle `box-shadow` with brand-glow tokens for elevated elements.
- Avoid pure black (`#000`) — the existing `surface` token (`#0f1117`) has this right.

## Avoiding "AI Slop"

When building or modifying UI, actively avoid these generic patterns:

- Evenly-spaced grids of identical cards with centered text and rounded icons
- Purple/blue gradient hero sections with "Get Started" CTAs
- Overly symmetric layouts — slight asymmetry feels more designed
- Cookie-cutter component patterns — adapt structure to the content
- Generic placeholder copy ("Lorem ipsum", "Your data here")

## What "Whimsy" Means Here

- A stat value that glows subtly in its tier color
- Tabular numbers that feel satisfying to scan (`font-variant-numeric: tabular-nums`)
- A sticky header that gains a subtle shadow as you scroll
- Empty states with personality (not just "No data available")
- Thoughtful use of opacity and transparency to create visual layers
- Tiny details: a 1px brand-colored border accent, a letter-spacing tweak on a label, monospace for numbers next to sans-serif for labels
