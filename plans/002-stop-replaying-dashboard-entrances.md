# 002 — Stop replaying dashboard entrances

- **Status**: DONE
- **Commit**: 70c3014
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file, under 15 lines changed

## Problem

Frequently mounted dashboard content receives a decorative 420ms `rise` animation. Screen navigation remounts `.mast` and panels, while filtering purchases can remount `.history article` entries. The animation also uses the CSS default `ease` because no timing function is declared.

```css
/* src/styles.css:1031 — current */
@media (prefers-reduced-motion: no-preference) {
  .authPanel,
  .mast,
  .meterCard,
  .entryPanel,
  .history article {
    animation: rise 420ms both;
  }

  .meterCard:nth-child(2) {
    animation-delay: 70ms;
  }

  .meterCard:nth-child(3) {
    animation-delay: 140ms;
  }
}
```

The surfaces are switched and filtered here:

```jsx
// src/main.jsx:268 — current
<main className="appShell">
  {screen === "home" ? <Home meters={meters} purchases={purchases} onNavigate={setScreen} /> : screen === "readings" ? <Readings

// src/main.jsx:483 — current
{matching.length ? <div className="purchaseCards">{matching.map((purchase) => <article className="purchaseCard" key={purchase.id}>
```

## Target

Dashboard navigation and list filtering must render immediately. Preserve one restrained entrance only for the rare missing-environment setup panel:

```css
@media (prefers-reduced-motion: no-preference) {
  .authPanel {
    animation: rise 240ms var(--ease-out) both;
  }
}
```

Keep the existing `@keyframes rise` unchanged because `.authPanel` still uses it. Delete the meter stagger rules entirely.

## Repo conventions to follow

- Plan 001 must be DONE first; `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` must exist in the root token block.
- The current reduced-motion convention uses `prefers-reduced-motion: no-preference` to opt into entrances.
- Motion remains CSS-only.

## Steps

1. In `src/styles.css`, reduce the selector list inside the `no-preference` block to `.authPanel` only.
2. Change the retained entrance to `animation: rise 240ms var(--ease-out) both`.
3. Delete both `.meterCard:nth-child(...)` delay rules.
4. Leave `@keyframes rise` untouched.

## Boundaries

- Do NOT add replacement screen transitions.
- Do NOT change React component keys, mounting behavior, or filtering logic.
- Do NOT remove the `rise` keyframes while `.authPanel` uses them.
- Do NOT touch dialog animations; plan 005 owns their accessibility behavior.
- If Plan 001 is not DONE or `--ease-out` is absent, STOP and execute Plan 001 first.

## Verification

- **Mechanical**: run `rg -n 'animation: rise|animation-delay' src/styles.css`; expect one `animation: rise` match and no `animation-delay` matches. Run `npm run build`; expect exit code 0.
- **Feel check**: run `npm run dev`, set DevTools animation playback to 10%, then switch repeatedly among Home, Electricity, Purchases, More, and back. Content must render without rising or staggering. Change purchase filters repeatedly; cards must not replay entrances.
- **Done when**: only `.authPanel` retains `rise`, normal dashboard navigation is immediate, filters do not replay list entrances, and reduced-motion behavior remains unchanged.
