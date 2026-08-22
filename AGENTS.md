# Personal Ledger — agent guide

Single-user PWA that tracks a workday: electricity meter readings, a server-accurate work/break timer, and a personal purchase log. React 19 + Vite 8, Supabase as the only backend, no auth layer. Mobile-first, dark, heavily themed and animated — the visual polish is the point of the project, not decoration.

## Commands

```bash
yarn dev        # vite --host 127.0.0.1
yarn build      # vite build -> dist/
yarn preview    # serve the build
yarn test       # node --test src/*.test.js  (no test framework, node:test only)
```

`npm` works too; both lockfiles are committed (`yarn.lock` is the current one).

## Stack

- **React 19.2** with `createRoot`, function components, no router — screens are a `screen` string in `App` state.
- **Vite 8** with `@vitejs/plugin-react` and `@tailwindcss/vite`. `@/*` aliases `./src/*` (see `vite.config.js` and `jsconfig.json`).
- **Tailwind v4** (CSS-first, no `tailwind.config`) imported at the top of `src/styles.css`, alongside `tw-animate-css` and `shadcn/tailwind.css`.
- **JavaScript, not TypeScript.** `.jsx`/`.js` only — `components.json` has `"tsx": false`. Do not introduce `.ts`/`.tsx` files.
- **motion** (`motion/react`) for animation; **three / @react-three/fiber / ogl / @paper-design/shaders-react** for the animated backgrounds; **lucide-react** for icons; **radix-ui** under shadcn.
- **Supabase JS 2.57** — direct table queries and Postgres RPCs from the client. No server, no API layer.

## Layout

```
src/
  main.jsx              ~750 lines. App root + Home, Electricity, Readings,
                        Purchases, More(Settings) screens, AppNavigation,
                        AppBackground, and the SW registration at the bottom.
  time-tracker.jsx      Time tracker screen (own file, own CSS).
  time.js               projectTimerSnapshot / formatDuration  (unit tested)
  electricity.js        bandFor / cyclesFor / isUnusedCycle / cycleDays /
                        unitsPerDay  (unit tested)
  theme-generator.js    createRandomTheme() / createThemeVariants() — OKLCH theme
                        generator: harmony + finish archetypes, gamut-fitted
                        chroma, contrast-guarded tones (unit tested)
  supabase.js           exports `supabase`, or `null` when env is missing
  styles.css            ~2300 lines. Design tokens, all 8 themes, every screen.
  time-tracker.css      Time tracker only.
  components/motion/    Animated primitives (beUI / React Bits installs, edited).
  components/ui/        shadcn components.
  lib/ease.js           Shared easing curves + spring presets. Use these.
  lib/hooks/            use-hover-capable — gate hover effects behind it.
supabase/migrations/    Plain SQL, applied manually. 5 migrations.
plans/                  Completed animation-refactor plans (001-005, all DONE).
.agents/skills/         18 vendored design/animation skills (skills-lock.json).
```

## Domain model

Three features, three data shapes:

**Electricity** — table `electricity_meter_readings`. Four meters listed in `defaultMeters`, referred to internally by stored names and remapped for display via `meterName`/`meterLabel` in `main.jsx` — three carry legacy names (`old-modern`, `old-classic`, `new - 1`) plus `sim-meter`. The names are load-bearing beyond display: the cabinet splits on the `old-` prefix, so anything not starting with `old-` lands in the "New meters" group. A meter appears as soon as it is in `defaultMeters`, with or without readings; there is no separate registration. Rows belong to a **billing cycle**: `cycle_start_date` is the day the utility took its reading (around the 25th, but it moves), and `previous_reading` is the reading they billed. Every row in a cycle repeats that same pair, so units = `current_reading - previous_reading`, floored at 0 — never a delta against the entry before. `cyclesFor` in `electricity.js` groups a meter's rows into cycles sorted by reading day, and flags the **live** one as the cycle declared most recently (earliest `created_at` in the group) — not the one with the latest date. That is deliberate: reading days get back-dated and corrected, so declaration order decides, which is what lets a reset dated 25 Aug and entered on 4 Sep take over from entries logged in between. "Start cycle" writes one row with `current_reading == previous_reading` at the billed reading; nothing is deleted, so past months stay in history. The exception is `isUnusedCycle` — a cycle holding only its opener and zero units is a leftover (typically from "Clear entries"), so declaring a new one updates that row in place rather than stacking a dead cycle behind it. `bandFor` colors the UI: calm ≤180, edge ≤190, danger >190 — the 200-unit slab limit is the whole reason this feature exists. "Clear entries" is the nuke: it inserts fresh baselines first, then deletes the old rows, rolling back the inserts if the delete fails.

**Time tracker** — tables `work_sessions` + `break_periods`, driven entirely by five `security invoker` RPCs: `time_tracker_clock_in / start_break / resume / clock_out / state`. All timing authority lives in Postgres (`clock_timestamp()`); the client only *projects* the last snapshot forward locally via `projectTimerSnapshot` and re-syncs on focus, visibility change, and reconnect. Weekends are rejected server-side. Target is 8h (480 min). The "user" is a UUID from `VITE_TIME_TRACKER_USER_ID` or a random one persisted in `localStorage` — there is no login.

**Purchases** — table `purchases`. Whole-PKR prices (`numeric(12,0)`), formatted with `Intl.NumberFormat("en-PK")`. Categories are a fixed list in `main.jsx`.

## Conventions that matter here

- **Styling is semantic CSS classes, not utility soup.** `className="meterCabinet"`, `className="ledgerCard"` — the class is then styled in `styles.css`. Tailwind utilities are used sparingly for one-off layout (`inline-flex items-center gap-2`) and safe-area padding. Follow the existing balance; don't rewrite a screen into utilities.
- **Themes are CSS custom properties on `:root[data-theme="..."]`.** The semantic tokens are `--bg --surface --surface-solid --glass --glass-border --text --heading --muted --accent --accent-rgb --accent-ink --glow-a --glow-b`; shadcn's variables (`--primary`, `--card`, …) are *mapped onto* them. Preserve these mappings when installing registry components. Generated themes set the same tokens inline on `documentElement` — the canonical list is `generatedThemeTokens` in `theme-generator.js`, and any new token must be added there or theme switching will leak values.
- **Persistence is `localStorage`**: `ledger-theme`, `ledger-background`, `ledger-custom-themes` (versioned — bump `version` in `createRandomTheme` when the token set changes), `personal-ledger-time-user`.
- **Motion uses the shared tokens** in `src/lib/ease.js` (`EASE_OUT`, `SPRING_PRESS`, `SPRING_SWAP`, `SPRING_PANEL`, `SPRING_LAYOUT`, `SPRING_MOUSE`). Don't hand-roll new curves; `plans/001` exists specifically because that had happened.
- **Reduced motion is respected throughout** — `useReducedMotion()` in components, `@media (prefers-reduced-motion: reduce)` blocks in both stylesheets. New animation must handle it (`plans/005`).
- **Hover effects go behind `useHoverCapable()`** — this is a mobile-first app and touch fires sticky phantom hover.
- Backgrounds are WebGL-heavy. `AppBackground` in `main.jsx` switches between 8 of them; `Silk` is lazy-loaded, and each takes a `key` tied to theme+background so it remounts on change.
- Async writes show an optimistic loading toast via `useAnimatedToastStack` and then `updateToast` to success/error. Keep that pattern for new mutations.
- Style of the codebase: terse, dense, ternary-chained JSX, no comments unless a rule is non-obvious. Match it rather than expanding it.

## Environment

`.env.local` (gitignored) needs a Supabase URL + anon key. Both `VITE_` and `EXPO_PUBLIC_` prefixes are accepted (see `envPrefix` in `vite.config.js` and `src/supabase.js`); the app renders a "Supabase env is missing" panel instead of crashing when they're absent.

```
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
VITE_TIME_TRACKER_USER_ID=   # optional; otherwise a local UUID is generated
```

## Database changes

Add a timestamped `.sql` file to `supabase/migrations/` and apply it yourself in the Supabase dashboard — there is no migration runner wired up. RLS is deliberately **off** (single-user brief); the time-tracker migration instead uses explicit `grant`/`revoke` on tables and functions. Preserve that pattern, and keep `security invoker` + `set search_path = ''` on new functions.

## PWA

`public/manifest.webmanifest` and `public/sw.js` (network-first, cache-fallback, cache name `personal-ledger-v2`). The SW is registered at the very bottom of `main.jsx`. Bump the cache name when the cached asset list changes.

## Testing

`node --test src/*.test.js`. Only the pure logic modules are tested — `time.js`, `electricity.js`, `theme-generator.js`. No component tests, no test runner dependency. New pure logic belongs in its own `src/*.js` module with a sibling `.test.js`; UI is verified by running the app.

# beUI

Use beUI for animated React UI when an existing registry component fits.

- MCP server: `https://mcp.beui.dev/mcp`
- Discover components: `npx shadcn@latest search @beui -q "<query>"`
- Inspect before installing: `npx shadcn@latest view @beui/<name>`
- Preview changes: `npx shadcn@latest add @beui/<name> --dry-run`
- Install: `npx shadcn@latest add @beui/<name>`
- Agent index: `https://beui.dev/llms.txt`
- Registry API: `https://beui.dev/r`

React Bits is registered too (`@react-bits`, `https://reactbits.dev/r/{name}.json`). Installed components land in `src/components/motion/` and are then edited by hand — read and verify every generated file, and re-map its colors onto this app's semantic tokens in `src/styles.css` rather than leaving raw shadcn defaults.
