import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import "./styles.css";

const defaultMeters = ["Main meter", "Upstairs meter", "Backup meter"];
const today = () => new Date().toISOString().slice(0, 10);
const unitsFor = (current, previous) => Math.max(0, Number(current || 0) - Number(previous || 0));
const bandFor = (units) => (units >= 200 ? "danger" : units > 190 ? "edge" : "calm");
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatRecentDate = (value, now = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffHours = Math.floor((now - date) / 36e5);
  const diffDays = Math.floor(diffHours / 24);
  const relative = diffHours < 24 ? `${Math.max(1, diffHours)}hr ago` : diffDays === 1 ? "yesterday" : `${diffDays} days ago`;
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = date.getHours() < 12 ? "AM" : "PM";
  const day = String(date.getDate()).padStart(2, "0");

  return `${relative} at ${hours}:${minutes} ${ampm} ${day}-${monthNames[date.getMonth()]}`;
};

function App() {
  const [readings, setReadings] = useState([]);
  const [activeMeter, setActiveMeter] = useState(defaultMeters[0]);
  const [form, setForm] = useState({ current_reading: "", previous_reading: "", reading_date: today() });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReadings();
  }, []);

  const meters = useMemo(() => {
    const names = [...new Set([...defaultMeters, ...readings.map((reading) => reading.meter_name)])];
    return names.map((name) => {
      const latest = readings.find((reading) => reading.meter_name === name);
      const units = latest ? unitsFor(latest.current_reading, latest.previous_reading) : 0;
      return { name, latest, units, band: latest ? bandFor(units) : "empty" };
    });
  }, [readings]);

  const activeMeterData = meters.find((meter) => meter.name === activeMeter);
  const activeLatest = activeMeterData?.latest;
  const activeUnits = activeMeterData?.units ?? 0;

  useEffect(() => {
    setForm((old) => ({
      ...old,
      current_reading: activeLatest?.current_reading ?? 0,
      previous_reading: activeLatest?.previous_reading ?? 0,
    }));
  }, [activeMeter, activeLatest?.current_reading, activeLatest?.previous_reading]);

  function stepReading(field, by) {
    setForm((old) => ({ ...old, [field]: String(Math.max(0, Number(old[field] || 0) + by)) }));
  }

  async function loadReadings() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("electricity_meter_readings")
      .select("id,meter_name,current_reading,previous_reading,units,reading_date,created_at")
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setReadings(data ?? []);
  }

  async function saveReading(event) {
    event.preventDefault();
    const current = Number(form.current_reading);
    const previous = Number(form.previous_reading);

    if (!Number.isFinite(current) || !Number.isFinite(previous) || current < previous) {
      setMessage("Current reading must be greater than or equal to previous reading.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("electricity_meter_readings").insert({
      meter_name: activeMeter,
      current_reading: current,
      previous_reading: previous,
      reading_date: form.reading_date,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Reading saved.");
      setForm({ current_reading: current, previous_reading: previous, reading_date: today() });
      loadReadings();
    }
  }

  if (!supabase) {
    return (
      <main className="authShell">
        <section className="authPanel">
          <p className="eyebrow">Setup</p>
          <h1>Supabase env is missing.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <header className="mast">
        <div>
          <p className="eyebrow">Personal Ledger</p>
          <h1>{activeUnits}<span> units</span></h1>
        </div>
      </header>

      <section className="limitStrip" aria-label="Consumption limits">
        <span>0</span>
        <div>
          <i style={{ width: `${Math.min(100, (activeUnits / 220) * 100)}%` }} />
          <b style={{ left: "86%" }}>190</b>
          <b style={{ left: "91%" }}>200</b>
        </div>
        <span>220</span>
      </section>

      <section className="meterList" aria-label="Meters">
        {meters.map((meter) => (
          <button
            className={meter.name === activeMeter ? `meterCard active ${meter.band}` : `meterCard ${meter.band}`}
            key={meter.name}
            type="button"
            onClick={() => setActiveMeter(meter.name)}
          >
            <span>{meter.name}</span>
            <strong>{meter.latest ? meter.units : "--"}</strong>
            <small>{meter.latest ? `${meter.latest.current_reading} now` : "No reading yet"}</small>
          </button>
        ))}
      </section>

      <form className="entryPanel" onSubmit={saveReading}>
        <div className="panelHead">
          <div>
            <p className="eyebrow">Meter readings</p>
            <h2>{activeMeter}</h2>
          </div>
        </div>
        <div className="readingGrid">
          <label>
            Current
            <input className="meterInput" type="number" min="0" step="1" required value={form.current_reading} onChange={(event) => setForm({ ...form, current_reading: event.target.value })} />
            <span className="stepControls">
              <button type="button" aria-label="Decrease current reading" onClick={() => stepReading("current_reading", -1)}>-</button>
              <button type="button" aria-label="Increase current reading" onClick={() => stepReading("current_reading", 1)}>+</button>
            </span>
          </label>
          <label>
            Previous
            <input className="meterInput" type="number" min="0" step="1" required value={form.previous_reading} onChange={(event) => setForm({ ...form, previous_reading: event.target.value })} />
            <span className="stepControls">
              <button type="button" aria-label="Decrease previous reading" onClick={() => stepReading("previous_reading", -1)}>-</button>
              <button type="button" aria-label="Increase previous reading" onClick={() => stepReading("previous_reading", 1)}>+</button>
            </span>
          </label>
        </div>
        <label>
          Date
          <input type="date" required value={form.reading_date} onChange={(event) => setForm({ ...form, reading_date: event.target.value })} />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save reading"}</button>
        {message && <p className="message">{message}</p>}
      </form>

      <section className="history" aria-label="Recent readings">
        <h2>Recent</h2>
        {readings.slice(0, 8).map((reading) => (
          <article key={reading.id}>
            <span>{reading.meter_name}</span>
            <strong>{unitsFor(reading.current_reading, reading.previous_reading)} units</strong>
            <time>{formatRecentDate(reading.created_at ?? reading.reading_date)}</time>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
