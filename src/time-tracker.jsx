import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { formatDuration, projectTimerSnapshot } from "./time";
import "./time-tracker.css";

const USER_KEY = "personal-ledger-time-user";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = {
  clockIn: ["time_tracker_clock_in", "Clock In"],
  break: ["time_tracker_start_break", "Start Break"],
  resume: ["time_tracker_resume", "Resume"],
  clockOut: ["time_tracker_clock_out", "Clock Out"],
};

function getUserId() {
  const configured = import.meta.env.VITE_TIME_TRACKER_USER_ID;
  if (UUID_PATTERN.test(configured ?? "")) return configured;

  const stored = localStorage.getItem(USER_KEY);
  if (UUID_PATTERN.test(stored ?? "")) return stored;

  const created = crypto.randomUUID();
  localStorage.setItem(USER_KEY, created);
  return created;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusLabel(status) {
  return { idle: "Ready", clocked_in: "Working", on_break: "On break", clocked_out: "Finished" }[status] ?? "Ready";
}

export function TimeTracker() {
  const userId = useMemo(getUserId, []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [snapshot, setSnapshot] = useState(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());
  const [tick, setTick] = useState(Date.now());
  const [visible, setVisible] = useState(!document.hidden);
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      setMessage("You’re offline. Reconnect to refresh your workday.");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("time_tracker_state", {
        p_user_id: userId,
        p_timezone: timezone,
        p_history_limit: 60,
      });
      if (error) throw error;
      setSnapshot(data);
      setSyncedAt(Date.now());
      setTick(Date.now());
      setOnline(true);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "The latest workday could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [timezone, userId]);

  useEffect(() => {
    sync();

    const onVisibility = () => {
      const isVisible = !document.hidden;
      setVisible(isVisible);
      if (isVisible) sync();
    };
    const onFocus = () => sync();
    const onOnline = () => {
      setOnline(true);
      sync();
    };
    const onOffline = () => {
      setOnline(false);
      setMessage("You’re offline. Reconnect before changing your work status.");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [sync]);

  useEffect(() => {
    if (!visible || !snapshot?.active_session) return undefined;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.active_session?.id, visible]);

  const display = useMemo(
    () => projectTimerSnapshot(snapshot, Math.floor((tick - syncedAt) / 1000)),
    [snapshot, syncedAt, tick],
  );

  async function runAction(action) {
    const [rpc, label] = ACTIONS[action];
    setBusy(action);
    setMessage("");
    try {
      const args = action === "clockIn" ? { p_user_id: userId, p_timezone: timezone } : { p_user_id: userId };
      const { error } = await supabase.rpc(rpc, args);
      if (error) throw error;
      await sync();
      setMessage(`${label} recorded.`);
    } catch (error) {
      setMessage(error.message || `${label} could not be recorded.`);
      await sync();
    } finally {
      setBusy("");
    }
  }

  if (loading && !display) {
    return <section className="timeTracker timeLoading" aria-busy="true"><span /><p>Syncing your workday…</p></section>;
  }

  if (!display) {
    return <section className="timeTracker timeError"><p className="eyebrow">Time tracker</p><h1>Workday unavailable.</h1><p>{message}</p><button type="button" onClick={sync}>Try again</button></section>;
  }

  const active = display.active_session;
  const today = display.today;
  const status = active?.status ?? today.status;
  const progress = Math.min(100, (today.worked_seconds / today.target_seconds) * 100);
  const canChange = online && !busy;
  const targetText = today.overtime_seconds > 0
    ? `${formatDuration(today.overtime_seconds, false)} overtime`
    : `${formatDuration(today.remaining_seconds, false)} remaining`;

  if (showHistory) {
    return <section className="timeTracker">
      <header className="timeMast historyMast">
        <button className="timeIconButton" type="button" aria-label="Back to time tracking" onClick={() => setShowHistory(false)}><BackIcon /></button>
        <div>
          <p className="timeEyebrow">Previous workdays</p>
          <h1>Work <em>history.</em></h1>
        </div>
        <span>{display.history.length} days</span>
      </header>
      <TimeHistory days={display.history} />
    </section>;
  }

  return <section className="timeTracker">
    <header className="timeMast">
      <div>
        <p className="timeEyebrow">Workday · {timezone}</p>
        <h1>Time <em>tracking.</em></h1>
      </div>
      <div className="timeMastActions">
        <button className="timeIconButton" type="button" aria-label="View work history" title="Work history" onClick={() => setShowHistory(true)}><HistoryIcon /></button>
        <span className={`statusPill ${status}`}><i />{statusLabel(status)}</span>
      </div>
    </header>

    {!display.is_weekday && !active && <aside className="weekendNotice" role="status">
      <CalendarIcon />
      <div><strong>Weekend mode</strong><span>Clock in opens again on Monday. Your history is still available.</span></div>
    </aside>}

    <div className="timeLayout">
      <div className="timerShell bezel">
        <article className="timerCore">
          <div className="workDial" style={{ "--work-progress": `${progress * 3.6}deg` }}>
            <div>
              <span>{active ? "Worked today" : today.worked_seconds ? "Day total" : "Today’s target"}</span>
              <strong>{formatDuration(today.worked_seconds)}</strong>
              <small>{targetText}</small>
            </div>
          </div>

          <div className="timeActions" aria-label="Work session actions">
            {!active && <ActionButton tone="primary" label="Clock In" icon={<PlayIcon />} disabled={!canChange || !display.is_weekday} busy={busy === "clockIn"} onClick={() => runAction("clockIn")} />}
            {active?.status === "clocked_in" && <ActionButton tone="break" label="Start Break" icon={<PauseIcon />} disabled={!canChange} busy={busy === "break"} onClick={() => runAction("break")} />}
            {active?.status === "on_break" && <ActionButton tone="primary" label="Resume" icon={<PlayIcon />} disabled={!canChange} busy={busy === "resume"} onClick={() => runAction("resume")} />}
            {active && <ActionButton tone="quiet" label="Clock Out" icon={<StopIcon />} disabled={!canChange} busy={busy === "clockOut"} onClick={() => runAction("clockOut")} />}
          </div>
          <p className="timeMessage" aria-live="polite">{message || (online ? "Synced with server time" : "Offline")}</p>
        </article>
      </div>

      <div className="timeSide">
        <div className="metricGrid">
          <Metric label="Clocked in" value={formatTime(active?.clocked_in_at ?? today.clocked_in_at)} note={active ? "Current session" : "First session"} />
          <Metric label="Current session" value={formatDuration(active?.worked_seconds ?? 0, false)} note="Breaks excluded" />
          <Metric label="Total breaks" value={formatDuration(today.break_seconds, false)} note={active?.status === "on_break" ? `Current · ${formatDuration(active.current_break_seconds)}` : "Across today"} accent={active?.status === "on_break"} />
          <Metric label={today.overtime_seconds ? "Overtime" : "Remaining"} value={formatDuration(today.overtime_seconds || today.remaining_seconds, false)} note="8 hour target" complete={today.target_met} />
        </div>

        {!active && today.worked_seconds > 0 && <div className="summaryShell bezel">
          <article className="summaryCore">
            <div><p className="timeEyebrow">Today’s summary</p><h2>{today.target_met ? "Target complete" : "Session closed"}</h2></div>
            <span className={today.target_met ? "targetMark complete" : "targetMark"}>{today.target_met ? "✓" : formatDuration(today.remaining_seconds, false)}</span>
            <dl>
              <div><dt>Clock in</dt><dd>{formatTime(today.clocked_in_at)}</dd></div>
              <div><dt>Clock out</dt><dd>{formatTime(today.clocked_out_at)}</dd></div>
              <div><dt>Worked</dt><dd>{formatDuration(today.worked_seconds, false)}</dd></div>
              <div><dt>Breaks</dt><dd>{formatDuration(today.break_seconds, false)}</dd></div>
            </dl>
          </article>
        </div>}
      </div>
    </div>

  </section>;
}

function TimeHistory({ days }) {
  return <div className="historyShell bezel">
    <section className="timeHistory" aria-label="Work history">
      {days.length ? <div className="historyTable">
        <div className="historyLabels" aria-hidden="true"><span>Date</span><span>In / out</span><span>Worked</span><span>Breaks</span><span>Target</span></div>
        {days.map((day) => <article key={day.work_date}>
          <strong>{formatDate(day.work_date)}</strong>
          <span data-label="In / out">{formatTime(day.clocked_in_at)} <i>→</i> {formatTime(day.clocked_out_at)}</span>
          <span data-label="Worked">{formatDuration(day.worked_seconds, false)}</span>
          <span data-label="Breaks">{formatDuration(day.break_seconds, false)}</span>
          <b className={day.target_met ? "met" : "short"}>{day.target_met ? "Complete" : `${formatDuration(day.remaining_seconds, false)} short`}</b>
        </article>)}
      </div> : <p className="timeEmpty">Finished workdays will appear here.</p>}
    </section>
  </div>;
}

function Metric({ label, value, note, accent = false, complete = false }) {
  return <div className={`metricShell bezel${accent ? " isBreak" : ""}${complete ? " isComplete" : ""}`}>
    <article className="metricCore"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
  </div>;
}

function ActionButton({ label, icon, tone, busy, ...props }) {
  return <button className={`timeAction ${tone}`} type="button" {...props}>
    <span>{busy ? "Recording…" : label}</span><i>{icon}</i>
  </button>;
}

function CalendarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>;
}

function HistoryIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l2.7 1.6" /></svg>;
}

function BackIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></svg>;
}

function PlayIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 7 8 5-8 5Z" /></svg>;
}

function PauseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 7v10M15 7v10" /></svg>;
}

function StopIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="8" height="8" rx="1" /></svg>;
}
