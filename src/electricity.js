export const bandFor = (units) => (units > 190 ? "danger" : units > 180 ? "edge" : "calm");

export const unitsFor = (current, previous) => Math.max(0, Number(current || 0) - Number(previous || 0));

// Rows saved before cycles existed have no cycle_start_date; they still share a
// baseline per cycle, so fall back to grouping on that.
const cycleKey = (reading) => reading.cycle_start_date ?? `baseline:${Number(reading.previous_reading ?? 0)}`;
const newestFirst = (a, b) => (a.reading_date === b.reading_date
  ? String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  : String(b.reading_date ?? "").localeCompare(String(a.reading_date ?? "")));

// One cycle per utility reading day: units are measured from the reading the
// company billed, never from the entry before. Newest reading day first, and
// the cycle you declared most recently is the live one — reading days move
// around and get corrected, so declaration order decides, not the date itself.
export function cyclesFor(readings) {
  const groups = new Map();
  readings.forEach((reading) => {
    const key = cycleKey(reading);
    groups.set(key, [...(groups.get(key) ?? []), reading]);
  });

  const cycles = [...groups.values()]
    .map((group) => {
      const entries = [...group].sort(newestFirst);
      const latest = entries[0];
      const startReading = Number(latest.previous_reading ?? 0);
      const startDate = latest.cycle_start_date ?? entries.reduce((earliest, reading) => (String(reading.reading_date) < earliest ? String(reading.reading_date) : earliest), String(latest.reading_date));
      const declaredAt = entries.reduce((first, reading) => (String(reading.created_at ?? "") < first ? String(reading.created_at ?? "") : first), String(latest.created_at ?? ""));
      return { startDate, startReading, declaredAt, latest, entries, units: unitsFor(latest.current_reading, startReading) };
    })
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));

  const live = cycles.reduce((newest, cycle) => (newest && newest.declaredAt >= cycle.declaredAt ? newest : cycle), null);
  return cycles.map((cycle) => (cycle === live ? { ...cycle, live: true } : cycle));
}

// A cycle nobody has logged a reading against is a leftover, not history —
// declaring a new one corrects it in place instead of stacking behind it.
export const isUnusedCycle = (cycle) => Boolean(cycle) && cycle.entries.length === 1 && cycle.units === 0;

export const cycleDays = (startDate, endDate) => {
  const start = Date.parse(`${startDate}T00:00:00`);
  const end = Date.parse(`${endDate}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
};

export const unitsPerDay = (units, days) => (days > 0 ? Math.round((units / days) * 10) / 10 : units);

// The saved previous_reading is the cycle baseline, so "added since last time"
// has to be measured against the entry logged before it on the same meter.
export function readingDeltas(readings) {
  const groups = new Map();
  readings.forEach((reading) => {
    groups.set(reading.meter_name, [...(groups.get(reading.meter_name) ?? []), reading]);
  });

  const deltas = new Map();
  groups.forEach((group) => {
    const entries = [...group].sort(newestFirst);
    entries.forEach((reading, index) => {
      const before = entries[index + 1];
      if (before) deltas.set(reading.id, unitsFor(reading.current_reading, before.current_reading));
    });
  });
  return deltas;
}
