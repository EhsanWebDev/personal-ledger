# 005 — Respect reduced motion throughout

- **Status**: DONE
- **Commit**: 70c3014
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 35 lines changed

## Problem

Reduced motion currently disables ambient backgrounds and opts out of `rise`, but purchase dialogs still translate and scale. Touch devices can also retain movement-based hover states because hover transforms are not gated to fine pointers.

```css
/* src/styles.css:307 — current */
.themeCard:hover { transform: translateY(-3px); }

/* src/styles.css:642 — current */
.purchaseFab:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 46px rgba(0, 0, 0, 0.38), 0 7px 22px rgba(240, 196, 72, 0.26), inset 0 1px rgba(255, 255, 255, 0.55);
}

/* src/styles.css:666 — current */
.dialogOverlay {
  /* visual declarations omitted */
  animation: veilIn 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

.purchaseDialog {
  /* visual declarations omitted */
  animation: dialogIn 420ms cubic-bezier(0.32, 0.72, 0, 1);
}

/* src/styles.css:1049 — current */
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}

/* src/styles.css:1233 — current */
@media (prefers-reduced-motion: reduce) {
  body::before,
  body::after {
    animation: none;
    will-change: auto;
  }
}
```

After Plans 001–004, dialog animation declarations will use `var(--ease-out)`, navigation transforms will take 160ms, and `.limitStrip i` will animate `scaleX` for 200ms.

## Target

Gate movement-based hover styles to devices that truly hover:

```css
@media (hover: hover) and (pointer: fine) {
  .themeCard:hover {
    transform: translateY(-3px);
  }
}

@media (hover: hover) and (pointer: fine) {
  .purchaseFab:hover {
    transform: translateY(-3px);
    box-shadow: 0 20px 46px rgba(0, 0, 0, 0.38), 0 7px 22px rgba(240, 196, 72, 0.26), inset 0 1px rgba(255, 255, 255, 0.55);
  }
}
```

Add an opacity-only dialog keyframe:

```css
@keyframes dialogFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

Consolidate reduced-motion overrides in the final, existing media block at the end of the file so they override the mobile `.purchaseDialog { animation-name: dialogInTop; }` rule:

```css
@media (prefers-reduced-motion: reduce) {
  body::before,
  body::after {
    animation: none;
    will-change: auto;
  }

  .dialogOverlay,
  .purchaseDialog {
    animation: dialogFadeIn 200ms ease;
  }

  .limitStrip i {
    transition: none;
  }

  .bottomNav button:active,
  .bottomNav button.active .navIcon,
  .homeGrid button:active,
  .themeCard:active,
  .meterCard.active,
  .purchaseFab:active {
    transform: none;
  }
}
```

Opacity and color feedback remain available. Position and scale movement are removed.

## Repo conventions to follow

- Execute Plans 001–004 first so the final reduced-motion block covers their completed motion surface.
- The final reduced-motion block at `src/styles.css:1233` already wins the cascade over mobile dialog styles; extend it instead of adding a third block.
- Keep semantic state feedback such as active colors, borders, and opacity.

## Steps

1. Wrap `.themeCard:hover` in the exact fine-pointer media query shown in **Target**.
2. Wrap `.purchaseFab:hover` in its own exact fine-pointer media query at its current location.
3. Delete the redundant early reduced-motion block at current `src/styles.css:1049-1051`; the final block already disables `body::before` and `body::after`.
4. Add `@keyframes dialogFadeIn` beside the other dialog keyframes.
5. Extend the final reduced-motion block with the dialog, progress, and interactive-transform overrides shown in **Target**.
6. Confirm the final block appears after the mobile `dialogInTop` assignment so reduced motion wins at every viewport width.

## Boundaries

- Do NOT disable all transitions globally.
- Do NOT remove opacity, color, border, or background feedback.
- Do NOT change the normal-motion dialog geometry or timing.
- Do NOT add JavaScript media-query listeners or dependencies.
- Do NOT implement the separate missed-opportunity dialog exit animation in this plan.
- If Plans 001–004 are not DONE, STOP and execute them in order first.

## Verification

- **Mechanical**: run `rg -n 'prefers-reduced-motion|dialogFadeIn|hover: hover|translateY\(-3px\)' src/styles.css`; expect two fine-pointer gates, one `dialogFadeIn` definition, and one final reduced-motion block. Run `npm run build`; expect exit code 0.
- **Feel check**: run `npm run dev`. With normal motion, confirm dialogs, meter fill, button presses, and fine-pointer hover still behave as before the plan. Emulate `prefers-reduced-motion: reduce`: open the purchase dialog at desktop and mobile widths and confirm it only fades; switch meters and confirm the fill snaps without traveling; press nav, cards, and FAB and confirm state color/border feedback remains without scale or translation. On a touch device or touch emulation, taps must not leave theme cards or the FAB lifted.
- **Done when**: dialog movement is removed under reduced motion, compositor movement does not play under reduced motion, touch cannot trigger sticky hover lifts, useful non-motion feedback remains, and the build succeeds.
