const clampSeconds = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function projectTimerSnapshot(snapshot, elapsedSeconds) {
  if (!snapshot?.active_session) return snapshot;

  const elapsed = clampSeconds(elapsedSeconds);
  const active = snapshot.active_session;
  const working = active.status === "clocked_in";
  const breaking = active.status === "on_break";
  const workedSeconds = clampSeconds(snapshot.today.worked_seconds) + (working ? elapsed : 0);
  const breakSeconds = clampSeconds(snapshot.today.break_seconds) + (breaking ? elapsed : 0);
  const targetSeconds = clampSeconds(snapshot.today.target_seconds || 28800);

  return {
    ...snapshot,
    active_session: {
      ...active,
      worked_seconds: clampSeconds(active.worked_seconds) + (working ? elapsed : 0),
      break_seconds: clampSeconds(active.break_seconds) + (breaking ? elapsed : 0),
      current_break_seconds: clampSeconds(active.current_break_seconds) + (breaking ? elapsed : 0),
    },
    today: {
      ...snapshot.today,
      worked_seconds: workedSeconds,
      break_seconds: breakSeconds,
      remaining_seconds: Math.max(0, targetSeconds - workedSeconds),
      overtime_seconds: Math.max(0, workedSeconds - targetSeconds),
      target_met: workedSeconds >= targetSeconds,
    },
  };
}

export function formatDuration(value, includeSeconds = true) {
  const seconds = clampSeconds(value);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return includeSeconds
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
