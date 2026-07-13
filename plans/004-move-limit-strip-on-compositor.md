# 004 — Move the limit strip on the compositor

- **Status**: DONE
- **Commit**: 70c3014
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, 4 declarations

## Problem

Switching meters or loading readings animates the fill element's `width` for 500ms. `width` triggers layout, and bare `ease` is not the strong ease-in-out curve appropriate for an on-screen value moving between states.

```jsx
// src/main.jsx:293 — current
<section className="limitStrip" aria-label="Consumption limits">
  <span>0</span>
  <div>
    <i style={{ width: `${Math.min(100, (activeUnits / 220) * 100)}%` }} />
    <b style={{ left: "86%" }}>190</b>
    <b style={{ left: "91%" }}>200</b>
  </div>
  <span>220</span>
</section>
```

```css
/* src/styles.css:425 — current */
.limitStrip i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #4fdf7a;
  transition: width 500ms ease;
}
```

## Target

Keep the element at full width and animate a unitless scale on the element itself:

```jsx
<i style={{ "--fill": Math.min(1, activeUnits / 220) }} />
```

```css
.limitStrip i {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: #4fdf7a;
  transform: scaleX(var(--fill));
  transform-origin: left;
  transition: transform 200ms var(--ease-in-out);
}
```

`--fill` must stay on the animated `<i>` itself; do not set it on `.limitStrip` or its parent, which would cause unnecessary descendant style recalculation.

## Repo conventions to follow

- Plan 001 must be DONE first; use `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`.
- Inline styles already carry data-derived visual values in this component.
- CSS transitions are the existing mechanism for deterministic motion.

## Steps

1. In `src/main.jsx:296`, replace the percentage `width` inline style with the numeric custom property `"--fill": Math.min(1, activeUnits / 220)`.
2. In `src/styles.css`, add `width: 100%` to `.limitStrip i`.
3. Replace `transition: width 500ms ease` with the exact transform, origin, and 200ms transition declarations in **Target**.
4. Do not alter threshold markers or the clamping behavior.

## Boundaries

- Do NOT add React state, effects, refs, requestAnimationFrame, or an animation library.
- Do NOT move `--fill` to a parent.
- Do NOT animate width, left, margin, padding, or other layout properties.
- Do NOT change the 190/200 threshold positions or the 220-unit maximum.
- If Plan 001 is not DONE or `--ease-in-out` is absent, STOP and execute Plan 001 first.

## Verification

- **Mechanical**: run `rg -n 'transition: width|--fill|scaleX' src/main.jsx src/styles.css`; expect no `transition: width`, one `--fill` assignment, and one `scaleX` declaration. Run `npm run build`; expect exit code 0.
- **Feel check**: run `npm run dev`, switch quickly among meters with very different readings, and confirm the fill retargets smoothly from its current position. In DevTools Performance, verify the transition updates `transform` without Layout events. At 10% playback, the fill must remain anchored to the left edge.
- **Done when**: fill geometry is driven by `scaleX`, duration is 200ms, rapid switching remains interruptible, layout is not animated, and the build succeeds.
