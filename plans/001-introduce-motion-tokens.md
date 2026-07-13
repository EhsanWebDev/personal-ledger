# 001 — Introduce semantic motion tokens

- **Status**: DONE
- **Commit**: 70c3014
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, about 20 declaration edits

## Problem

`src/styles.css` repeats one drawer-like curve for unrelated interactions. Entrances, button presses, hover/color changes, and theme changes therefore share motion semantics even though they should not.

Every current occurrence of `cubic-bezier(0.32, 0.72, 0, 1)` is listed below:

```css
/* src/styles.css:113 — current */
transition: color 320ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:130 — current */
transition: background 320ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 320ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:213 — current */
transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1), border-color 320ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:304 — current */
transition: transform 420ms cubic-bezier(0.32, 0.72, 0, 1), border-color 420ms cubic-bezier(0.32, 0.72, 0, 1), background 420ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:329 — current */
.themeCheck { position: absolute; right: 14px; bottom: 17px; display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; color: var(--accent-ink); background: var(--accent); font-size: 12px; font-style: normal; opacity: 0; transform: scale(0.7); transition: opacity 300ms cubic-bezier(0.32, 0.72, 0, 1), transform 300ms cubic-bezier(0.32, 0.72, 0, 1); }

/* src/styles.css:333 — current */
body { color: var(--text); background: var(--bg); transition: background-color 700ms cubic-bezier(0.32, 0.72, 0, 1), color 700ms cubic-bezier(0.32, 0.72, 0, 1); }

/* src/styles.css:639 — current */
transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 320ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:672 — current */
animation: veilIn 280ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:691 — current */
animation: dialogIn 420ms cubic-bezier(0.32, 0.72, 0, 1);

/* src/styles.css:915 — current */
transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1), color 260ms cubic-bezier(0.32, 0.72, 0, 1), background 260ms cubic-bezier(0.32, 0.72, 0, 1);
```

## Target

Add only the two custom curves the current UI actually needs. Native `ease` remains the token for hover and color changes; there is no drawer, so do not add an unused drawer token.

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  /* existing color tokens continue below */
}
```

Map properties by purpose:

- Entering or exiting (`veilIn`, `dialogIn`, `.themeCheck`) → `var(--ease-out)`.
- Transform feedback (`.bottomNav button`, `.navIcon`, `.homeGrid button`, `.themeCard`, `.purchaseFab`) → `var(--ease-out)`.
- Color, border, background, and box-shadow changes → native `ease`.
- `.categoryFilters button` has no transform state; delete its unused `transform` transition and keep `color 260ms ease, background 260ms ease`.
- Preserve every current duration in this plan. Plans 003 and 004 own duration changes.

Representative target declarations:

```css
.bottomNav button {
  transition: color 320ms ease, transform 320ms var(--ease-out);
}

.navIcon {
  transition: background 320ms ease, box-shadow 320ms ease, transform 320ms var(--ease-out);
}

.homeGrid button {
  transition: transform 320ms var(--ease-out), border-color 320ms ease;
}

.themeCard {
  transition: transform 420ms var(--ease-out), border-color 420ms ease, background 420ms ease;
}

.themeCheck {
  transition: opacity 300ms var(--ease-out), transform 300ms var(--ease-out);
}

body {
  transition: background-color 700ms ease, color 700ms ease;
}

.purchaseFab {
  transition: transform 320ms var(--ease-out), box-shadow 320ms ease;
}

.dialogOverlay { animation: veilIn 280ms var(--ease-out); }
.purchaseDialog { animation: dialogIn 420ms var(--ease-out); }

.categoryFilters button {
  transition: color 260ms ease, background 260ms ease;
}
```

## Repo conventions to follow

- Global theme variables already live in the opening `:root` block at `src/styles.css:1`; place motion variables there.
- CSS owns all current motion. Do not add React animation state or a dependency.
- Keep the existing compact one-line declarations compact where they are already one line.

## Steps

1. In `src/styles.css:1`, add `--ease-out` and `--ease-in-out` to `:root` before the color variables.
2. Replace every occurrence listed in **Problem** using the property mapping in **Target**.
3. Remove only the unused `transform 260ms ...` item from `.categoryFilters button`.
4. Run the mechanical checks and confirm `cubic-bezier(0.32, 0.72, 0, 1)` no longer appears.

## Boundaries

- Do NOT change durations in this plan.
- Do NOT alter keyframe geometry or state transforms.
- Do NOT touch `src/main.jsx`.
- Do NOT add dependencies or JavaScript animation.
- If the listed declarations differ from commit `70c3014`, STOP and report the drift instead of improvising.

## Verification

- **Mechanical**: run `rg -n 'cubic-bezier\(0\.32, 0\.72, 0, 1\)' src/styles.css` and expect no matches; run `npm run build` and expect exit code 0.
- **Feel check**: run `npm run dev`, inspect Home, More, Purchases, and the purchase dialog, then confirm no interaction changed duration or geometry. At 10% playback speed, transform feedback should start decisively while color changes remain smooth.
- **Done when**: both variables exist, all ten repeated curve sites use semantic easing, the unused filter transform transition is gone, and the build succeeds.
