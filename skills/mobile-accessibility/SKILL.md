---
name: mobile-accessibility
description: Build, change, review, or debug this project's UI with a mobile-first, accessible approach. Use for every UI task involving pages, components, layouts, navigation, menus, dropdowns, forms, dialogs, touch interactions, responsive CSS, or visual design. Keep the supported layout within phone and iPad widths; do not design or optimize for desktop-only screens.
---

# Mobile Accessibility

Treat phones as the default canvas and iPad as the largest supported layout. Build progressively from a narrow viewport; add wider layout changes only when they improve iPad use.

## Layout and interaction

- Start at 320px wide; keep content usable through 768px and up to 1024px iPad widths in both portrait and landscape.
- Use one-column flows by default. Preserve reading order when grids collapse; avoid horizontal page scrolling, fixed-width panels, hover-only controls, and information hidden solely by a breakpoint.
- Respect device safe areas and dynamic viewport height. Do not trap primary actions behind sticky UI, browser chrome, or the keyboard.
- Make every interactive target at least 44 by 44 CSS pixels, with adequate spacing so adjacent controls cannot be tapped accidentally.
- Provide visible keyboard focus; never remove outlines unless replacing them with an equally clear focus indicator. Ensure the order of focus matches the visual and reading order.
- Support touch, mouse, and keyboard without requiring hover. Use `:focus-visible` and `prefers-reduced-motion`; keep motion optional and brief.

## Accessible components

- Use native semantic controls first: `button`, `a`, `input`, `select`, `textarea`, `label`, `fieldset`, and `legend`. Do not turn generic elements into controls when a native element works.
- Give icon-only controls an accessible name. Associate every input with a persistent visible label; do not use placeholder text as its only label.
- Explain errors in text near the relevant field, connect them programmatically, and do not rely on colour alone. Preserve typed values after validation errors.
- For custom dropdowns, menus, comboboxes, dialogs, tabs, and disclosures, use a proven accessible component primitive where available. Implement the expected keyboard behavior, focus management, Escape handling, and correct ARIA state only when native HTML cannot provide it.
- Make menus and dialogs fully operable on a narrow viewport: move focus into an opened dialog, return it to the trigger when closed, prevent background interaction, and avoid clipped or unreachable content.
- Use landmarks, correctly nested headings, descriptive link/button text, and meaningful alternative text. Announce important asynchronous status changes without interrupting the user.

## Visual accessibility

- Meet WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text and essential controls. Do not communicate state, errors, or selected values by colour alone.
- Let text reflow with browser zoom and system font scaling. Avoid fixed text heights, text embedded in images, and layouts that depend on a single font size.
- Keep form controls, text, and status messages legible in light and dark themes if both are supported.

## Completion check

Before finishing a UI change, verify at a narrow phone width and at iPad portrait/landscape widths. Check keyboard-only navigation, visible focus, input labels and errors, open/close behavior for navigation and overlays, 44px touch targets, no horizontal overflow, and reduced-motion behavior.
