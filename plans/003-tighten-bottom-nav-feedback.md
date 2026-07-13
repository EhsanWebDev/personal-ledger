# 003 — Tighten bottom navigation feedback

- **Status**: DONE
- **Commit**: 70c3014
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 3 declarations

## Problem

The app's highest-frequency control uses symmetric 320ms transitions and compresses to `scale(0.94)`. Press feedback should complete in 100–160ms and stay within the subtle `0.95–0.98` scale range.

```css
/* src/styles.css:100 — current at commit 70c3014 */
.bottomNav button {
  /* layout declarations omitted */
  transition: color 320ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.bottomNav button:active {
  transform: scale(0.94);
}

/* src/styles.css:124 — current at commit 70c3014 */
.navIcon {
  /* layout declarations omitted */
  transition: background 320ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 320ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}
```

After required Plan 001, the same declarations should use `ease` for visual properties and `var(--ease-out)` for transforms, but their duration will still be 320ms.

## Target

```css
.bottomNav button {
  transition: color 160ms ease, transform 160ms var(--ease-out);
}

.bottomNav button:active {
  transform: scale(0.97);
}

.navIcon {
  transition: background 160ms ease, box-shadow 160ms ease, transform 160ms var(--ease-out);
}
```

Do not change the active icon's existing `translateY(-1px)`; it is a subtle selected-state indication.

## Repo conventions to follow

- Plan 001 must be DONE first; use its `--ease-out` token rather than repeating a cubic-bezier.
- Keep transitions property-scoped. Do not introduce `transition: all`.
- The existing navigation markup and `aria-current` behavior in `src/main.jsx:351-364` are correct and remain untouched.

## Steps

1. In `.bottomNav button`, change both transition durations from `320ms` to `160ms` while preserving the semantic easings established by Plan 001.
2. Change `.bottomNav button:active` from `scale(0.94)` to `scale(0.97)`.
3. In `.navIcon`, change all three transition durations from `320ms` to `160ms` while preserving the semantic easings established by Plan 001.

## Boundaries

- Do NOT change navigation markup, routing state, icon size, selected colors, shadows, or `translateY(-1px)`.
- Do NOT add a spring or animation library.
- Do NOT add new tokens; Plan 001 owns tokens.
- If Plan 001 is not DONE or the post-Plan-001 declarations do not match the stated precondition, STOP and report.

## Verification

- **Mechanical**: run `rg -n -A 35 '\.bottomNav button \{' src/styles.css` and confirm the navigation block contains no `320ms` and uses `scale(0.97)`. Run `npm run build`; expect exit code 0.
- **Feel check**: run `npm run dev`; tap each navigation item rapidly with mouse and keyboard. Press feedback must register immediately and release without a lingering shrink. At 10% playback, the button must never dip below 97% scale and selected-state feedback must settle in 160ms.
- **Done when**: both nav transition groups use 160ms, press scale is 0.97, rapid navigation remains interruptible, and the build succeeds.
