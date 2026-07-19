import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DynamicIsland, DynamicIslandView } from "@/components/motion/dynamic-island";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Loader } from "@/components/motion/loader";
import { supabase } from "./supabase";
import { formatDuration, projectTimerSnapshot } from "./time";
import "./time-tracker.css";

const USER_KEY = "personal-ledger-time-user";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = {
  clockIn: ["time_tracker_clock_in", "Clock In", "Starting time tracking…", "Time tracking started", "Your work session is now running."],
  break: ["time_tracker_start_break", "Start Break", "Starting your break…", "Break started", "Work time is paused until you resume."],
  resume: ["time_tracker_resume", "Resume", "Resuming time tracking…", "Time tracking resumed", "Your work session is running again."],
  clockOut: ["time_tracker_clock_out", "Clock Out", "Clocking out…", "Clocked out", "Today’s work session has been closed."],
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

const formatClock = (value) => formatTime(value);
const formatFullDuration = (value) => formatDuration(value);
const formatShortDuration = (value) => formatDuration(value, false);

function DurationNumber({ value, short = false }) {
  return <NumberTicker value={value} duration={0.55} format={short ? formatShortDuration : formatFullDuration} />;
}

function ClockNumber({ value }) {
  return value ? <NumberTicker value={new Date(value).getTime()} duration={0.55} format={formatClock} /> : "—";
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

export function TimeTracker({ showToast, updateToast }) {
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
    const [rpc, label, pendingTitle, successTitle, successDescription] = ACTIONS[action];
    const toastId = showToast({ title: pendingTitle, description: "Syncing with server time", status: "loading", duration: 0, dismissible: false });
    setBusy(action);
    setMessage("");
    try {
      const args = action === "clockIn" ? { p_user_id: userId, p_timezone: timezone } : { p_user_id: userId };
      const { error } = await supabase.rpc(rpc, args);
      if (error) throw error;
      await sync();
      setMessage(`${label} recorded.`);
      updateToast(toastId, { title: successTitle, description: successDescription, status: "success", duration: 4200, dismissible: true });
    } catch (error) {
      const description = error.message || `${label} could not be recorded.`;
      setMessage(description);
      updateToast(toastId, { title: `${label} failed`, description, status: "error", duration: 5200, dismissible: true });
      await sync();
    } finally {
      setBusy("");
    }
  }

  if (loading && !display) {
    return <section className="timeTracker timeLoading" aria-busy="true"><Loader variant="scramble" size={48} speed={1.2} label="Syncing your workday" /><p>Syncing your workday…</p></section>;
  }

  if (!display) {
    return <section className="timeTracker timeError"><p className="eyebrow">Time tracker</p><h1>Workday unavailable.</h1><p>{message}</p><button type="button" onClick={sync}>Try again</button></section>;
  }

  const active = display.active_session;
  const today = display.today;
  const status = active?.status ?? today.status;
  const progress = Math.min(100, (today.worked_seconds / today.target_seconds) * 100);
  const canChange = online && !busy;
  if (showHistory) {
    return <section className="timeTracker">
      <header className="timeMast historyMast">
        <button className="timeIconButton" type="button" aria-label="Back to time tracking" onClick={() => setShowHistory(false)}><BackIcon /></button>
        <div>
          <h1>Work <em>history.</em></h1>
        </div>
        <span><NumberTicker value={display.history.length} duration={0.55} /> days</span>
      </header>
      <TimeHistory days={display.history} />
    </section>;
  }

  return <section className="timeTracker">
    <header className="timeMast">
      <div>
        <h1>Time <em>tracking.</em></h1>
      </div>
      <div className="timeMastActions">
        <button className="timeIconButton" type="button" aria-label="View work history" title="Work history" onClick={() => setShowHistory(true)}><HistoryIcon /></button>
        <span className={`statusPill ${status}`}><i />{statusLabel(status)}</span>
      </div>
    </header>

    {active ? <div className="flex justify-center">
      <DynamicIsland view={active.status}>
        <DynamicIslandView id="clocked_in" className="gap-3 px-5 py-3">
          <span className="grid size-9 place-items-center rounded-full bg-background/10"><ClockIcon /></span>
          <span className="flex min-w-32 flex-col">
            <small className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">Working</small>
            <strong className="text-lg font-bold leading-tight tabular-nums"><DurationNumber value={today.worked_seconds} /></strong>
          </span>
        </DynamicIslandView>
        <DynamicIslandView id="on_break" className="gap-3 px-5 py-3">
          <span className="grid size-9 place-items-center rounded-full bg-warning text-background"><PauseIcon /></span>
          <span className="flex min-w-32 flex-col">
            <small className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">On break</small>
            <strong className="text-lg font-bold leading-tight tabular-nums"><DurationNumber value={today.worked_seconds} /></strong>
          </span>
        </DynamicIslandView>
      </DynamicIsland>
    </div> : null}

    {!display.is_weekday && !active && <aside className="weekendNotice" role="status">
      <CalendarIcon />
      <div><strong>Weekend mode</strong><span>Clock in opens again on Monday. Your history is still available.</span></div>
    </aside>}

    <div className="timeLayout">
      <div className="timerShell bezel">
        <article className="ledgerCard timerCore">
          <div className="timerOverview">
            <div className="timerCopy">
              <span className="timerLabel">{active ? "Worked today" : today.worked_seconds ? "Day total" : "Today’s target"}</span>
              <strong className="timerValue"><DurationNumber value={today.worked_seconds} /></strong>
              <p className={today.overtime_seconds > 0 ? "timerRemaining overtime" : "timerRemaining"}>
                <b><DurationNumber value={today.overtime_seconds || today.remaining_seconds} short /></b>
                <span>{today.overtime_seconds > 0 ? "overtime" : "remaining to target"}</span>
              </p>
            </div>
            <WorkProgress progress={progress} />
          </div>

          <div className="timerFooter">
            <div className="timeActions" aria-label="Work session actions">
              {!active && <ActionButton tone="primary" label="Clock In" icon={<PlayIcon />} disabled={!canChange || !display.is_weekday} busy={busy === "clockIn"} onClick={() => runAction("clockIn")} />}
              {active?.status === "clocked_in" && <ActionButton tone="break" label="Start Break" icon={<PauseIcon />} disabled={!canChange} busy={busy === "break"} onClick={() => runAction("break")} />}
              {active?.status === "on_break" && <ActionButton tone="primary" label="Resume" icon={<PlayIcon />} disabled={!canChange} busy={busy === "resume"} onClick={() => runAction("resume")} />}
              {active && <ActionButton tone="quiet" label="Clock Out" icon={<StopIcon />} disabled={!canChange} busy={busy === "clockOut"} onClick={() => runAction("clockOut")} />}
            </div>
            {message || !online ? <p className="timeMessage" aria-live="polite">{message || "Offline"}</p> : null}
          </div>
        </article>
      </div>

      <div className="timeSide">
        <div className="detailsShell bezel">
          <dl className="ledgerCard timeDetails" aria-label="Today’s session details">
            <div>
              <dt>Clocked in</dt>
              <dd><ClockNumber value={active?.clocked_in_at ?? today.clocked_in_at} /></dd>
            </div>
            <div className={active?.status === "on_break" ? "isBreak" : undefined}>
              <dt>{active?.status === "on_break" ? "On break" : "Breaks today"}</dt>
              <dd><DurationNumber value={active?.status === "on_break" ? active.current_break_seconds : today.break_seconds} short /></dd>
            </div>
          </dl>
        </div>

        {!active && today.worked_seconds > 0 && <div className="summaryShell bezel">
          <article className="ledgerCard summaryCore">
            <div><p className="timeEyebrow">Today’s summary</p><h2>{today.target_met ? "Target complete" : "Session closed"}</h2></div>
            <span className={today.target_met ? "targetMark complete" : "targetMark"}>{today.target_met ? "✓" : <DurationNumber value={today.remaining_seconds} short />}</span>
            <dl>
              <div><dt>Clock in</dt><dd><ClockNumber value={today.clocked_in_at} /></dd></div>
              <div><dt>Clock out</dt><dd><ClockNumber value={today.clocked_out_at} /></dd></div>
              <div><dt>Worked</dt><dd><DurationNumber value={today.worked_seconds} short /></dd></div>
              <div><dt>Breaks</dt><dd><DurationNumber value={today.break_seconds} short /></dd></div>
            </dl>
          </article>
        </div>}
      </div>
    </div>

  </section>;
}

function TimeHistory({ days }) {
  return <div className="historyShell bezel">
    <section className="ledgerCard timeHistory" aria-label="Work history">
      {days.length ? <div className="historyTable">
        <div className="historyLabels" aria-hidden="true"><span>Date</span><span>In / out</span><span>Worked</span><span>Breaks</span><span>Target</span></div>
        {days.map((day) => <article className="ledgerCard" key={day.work_date}>
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

function ActionButton({ label, icon, tone, busy, ...props }) {
  return <button className={`timeAction ${tone}`} type="button" {...props}>
    <span>{busy ? "Recording…" : label}</span><i>{busy ? <Loader variant="dots" size={16} label={`Recording ${label}`} /> : icon}</i>
  </button>;
}

function WorkProgress({ progress }) {
  const reduceMotion = useReducedMotion();
  const value = Math.max(0, Math.min(100, progress));

  return <div className="workProgress" role="progressbar" aria-label="Today’s work target" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(value)}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle className="workProgressTrack" cx="60" cy="60" r="51" pathLength="1" />
      <motion.circle
        className="workProgressValue"
        cx="60"
        cy="60"
        r="51"
        pathLength="1"
        initial={false}
        animate={{ pathLength: value / 100 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", duration: 0.8, bounce: 0 }}
      />
    </svg>
    <span><strong>{Math.round(value)}%</strong><small>complete</small></span>
  </div>;
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

function ClockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></svg>;
}

function PauseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 7v10M15 7v10" /></svg>;
}

function StopIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="8" height="8" rx="1" /></svg>;
}
