import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, projectTimerSnapshot } from "./time.js";

const snapshot = (status) => ({
  active_session: { status, worked_seconds: 3600, break_seconds: 600, current_break_seconds: status === "on_break" ? 300 : 0 },
  today: { worked_seconds: 7200, break_seconds: 600, target_seconds: 28800 },
});

test("projects work and break displays without mixing the two", () => {
  const working = projectTimerSnapshot(snapshot("clocked_in"), 90);
  assert.equal(working.today.worked_seconds, 7290);
  assert.equal(working.today.break_seconds, 600);

  const breaking = projectTimerSnapshot(snapshot("on_break"), 90);
  assert.equal(breaking.today.worked_seconds, 7200);
  assert.equal(breaking.today.break_seconds, 690);
  assert.equal(breaking.active_session.current_break_seconds, 390);
  assert.equal(formatDuration(3661), "01:01:01");
});
