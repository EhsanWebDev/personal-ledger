import assert from "node:assert/strict";
import test from "node:test";

import { bandFor, cycleDays, cyclesFor, isUnusedCycle, unitsFor, unitsPerDay } from "./electricity.js";

const reading = (values) => ({ id: values.reading_date + values.current_reading, created_at: `${values.reading_date}T09:00:00+00:00`, ...values });

test("electricity unit bands change above 180 and 190 units", () => {
  assert.equal(bandFor(180), "calm");
  assert.equal(bandFor(181), "edge");
  assert.equal(bandFor(190), "edge");
  assert.equal(bandFor(191), "danger");
});

test("units are measured from the cycle baseline and never go negative", () => {
  assert.equal(unitsFor(45390, 45210), 180);
  assert.equal(unitsFor(45100, 45210), 0);
});

test("readings group into one cycle per utility reading day, newest first", () => {
  const cycles = cyclesFor([
    reading({ meter_name: "new - 1", cycle_start_date: "2026-07-24", previous_reading: 45000, current_reading: 45210, reading_date: "2026-08-24" }),
    reading({ meter_name: "new - 1", cycle_start_date: "2026-07-24", previous_reading: 45000, current_reading: 45000, reading_date: "2026-07-24" }),
    reading({ meter_name: "new - 1", cycle_start_date: "2026-08-25", previous_reading: 45210, current_reading: 45210, reading_date: "2026-08-25" }),
    reading({ meter_name: "new - 1", cycle_start_date: "2026-08-25", previous_reading: 45210, current_reading: 45298, reading_date: "2026-09-04" }),
  ]);

  assert.equal(cycles.length, 2);
  assert.deepEqual(cycles.map(({ startDate }) => startDate), ["2026-08-25", "2026-07-24"]);
  assert.deepEqual(cycles.map(({ units }) => units), [88, 210]);
  assert.equal(cycles[0].startReading, 45210);
  assert.equal(cycles[0].entries.length, 2);
});

test("a reset back-dated to the reading day takes over from entries logged after it", () => {
  const live = cyclesFor([
    { id: "a0", cycle_start_date: "2026-07-24", previous_reading: 45000, current_reading: 45000, reading_date: "2026-07-24", created_at: "2026-07-24T09:00:00+00:00" },
    { id: "a1", cycle_start_date: "2026-07-24", previous_reading: 45000, current_reading: 45180, reading_date: "2026-08-30", created_at: "2026-08-30T09:00:00+00:00" },
    { id: "b0", cycle_start_date: "2026-08-25", previous_reading: 45210, current_reading: 45210, reading_date: "2026-08-25", created_at: "2026-09-04T09:00:00+00:00" },
  ]).find(({ live: isLive }) => isLive);

  assert.equal(live.startDate, "2026-08-25");
  assert.equal(live.startReading, 45210);
  assert.equal(live.units, 0);
});

test("a cycle declared later goes live even when its reading day is earlier", () => {
  const cycles = cyclesFor([
    { id: "leftover", cycle_start_date: "2026-08-05", previous_reading: 2340, current_reading: 2340, reading_date: "2026-08-05", created_at: "2026-08-05T09:12:53+00:00" },
    { id: "corrected", cycle_start_date: "2026-07-25", previous_reading: 2340, current_reading: 2340, reading_date: "2026-07-25", created_at: "2026-08-22T10:31:37+00:00" },
  ]);

  assert.equal(cycles.find(({ live }) => live).startDate, "2026-07-25");
  assert.deepEqual(cycles.map(({ startDate }) => startDate), ["2026-08-05", "2026-07-25"]);
});

test("only a cycle with nothing logged against it is corrected in place", () => {
  const [leftover] = cyclesFor([reading({ cycle_start_date: "2026-08-05", previous_reading: 2340, current_reading: 2340, reading_date: "2026-08-05" })]);
  const [used] = cyclesFor([
    reading({ cycle_start_date: "2026-08-05", previous_reading: 2340, current_reading: 2340, reading_date: "2026-08-05" }),
    reading({ cycle_start_date: "2026-08-05", previous_reading: 2340, current_reading: 2411, reading_date: "2026-08-19" }),
  ]);
  const [legacySingle] = cyclesFor([reading({ previous_reading: 44800, current_reading: 44990, reading_date: "2026-07-10" })]);

  assert.equal(isUnusedCycle(leftover), true);
  assert.equal(isUnusedCycle(used), false);
  assert.equal(isUnusedCycle(legacySingle), false);
  assert.equal(isUnusedCycle(undefined), false);
});

test("readings saved before cycles existed group by their shared baseline", () => {
  const cycles = cyclesFor([
    reading({ previous_reading: 45000, current_reading: 45120, reading_date: "2026-08-02" }),
    reading({ previous_reading: 45000, current_reading: 45190, reading_date: "2026-08-20" }),
    reading({ previous_reading: 44800, current_reading: 44990, reading_date: "2026-07-10" }),
  ]);

  assert.deepEqual(cycles.map(({ startDate }) => startDate), ["2026-08-02", "2026-07-10"]);
  assert.deepEqual(cycles.map(({ units }) => units), [190, 190]);
});

test("cycle length and daily average track a variable reading day", () => {
  assert.equal(cycleDays("2026-08-25", "2026-09-04"), 10);
  assert.equal(cycleDays("2026-08-25", "2026-08-25"), 0);
  assert.equal(cycleDays("", "2026-09-04"), 0);
  assert.equal(unitsPerDay(88, 10), 8.8);
  assert.equal(unitsPerDay(88, 0), 88);
});
