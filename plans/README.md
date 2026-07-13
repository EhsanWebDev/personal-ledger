# Animation improvement plans

All plans were authored against commit `70c3014`. Execute them in the order below because later plans rely on tokens or motion surfaces established by earlier plans.

| Order | Plan | Audit finding | Severity | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | [001 — Introduce semantic motion tokens](001-introduce-motion-tokens.md) | 5 | MEDIUM | DONE | — |
| 2 | [002 — Stop replaying dashboard entrances](002-stop-replaying-dashboard-entrances.md) | 1 | HIGH | DONE | 001 |
| 3 | [003 — Tighten bottom navigation feedback](003-tighten-bottom-nav-feedback.md) | 2 | HIGH | DONE | 001 |
| 4 | [004 — Move the limit strip on the compositor](004-move-limit-strip-on-compositor.md) | 3 | MEDIUM | DONE | 001 |
| 5 | [005 — Respect reduced motion throughout](005-respect-reduced-motion.md) | 4 | MEDIUM | DONE | 001–004 |

## Recommended execution

Run one plan at a time and complete its mechanical and feel checks before marking it DONE. Plan 005 intentionally runs last so its reduced-motion overrides cover the final navigation and limit-strip behavior.

These plans do not include the two additive audit opportunities: purchase-dialog exit motion and animated status-message entry. Revisit those only after the corrective plans are complete and feel-tested.
