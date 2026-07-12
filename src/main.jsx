import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Limelight } from "@getlimelight/sdk";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "./supabase";
import "./styles.css";

Limelight.connect();

const defaultMeters = ["old-modern", "old-classic", "new - 1"];
const renamedMeters = { "Main meter": "old-modern", "Upstairs meter": "old-classic", "Backup meter": "new - 1" };
const meterName = (name) => renamedMeters[name] ?? name;
const today = () => new Date().toISOString().slice(0, 10);
const unitsFor = (current, previous) => Math.max(0, Number(current || 0) - Number(previous || 0));
const bandFor = (units) => (units >= 200 ? "danger" : units > 190 ? "edge" : "calm");
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const purchaseCategories = ["Mobile", "Laptop", "PC", "TWS earbuds", "Smartwatch", "Tablet", "Camera", "Gaming"];
const currency = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
const themes = [
  { id: "ledger", name: "Ledger", note: "Moss & brass", colors: ["#101412", "#f0c448"] },
  { id: "aurora", name: "Aurora", note: "Ink & orchid", colors: ["#0b1020", "#a78bfa"] },
  { id: "tide", name: "Volt", note: "Carbon & chartreuse", colors: ["#0d110b", "#a2d729"] },
  { id: "ember", name: "Mulberry", note: "Wine & blush", colors: ["#1b0d18", "#ff9fc7"] },
];
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
  const [screen, setScreen] = useState("home");
  const [theme, setTheme] = useState(() => localStorage.getItem("ledger-theme") || "ledger");
  const [readings, setReadings] = useState([]);
  const [activeMeter, setActiveMeter] = useState(defaultMeters[0]);
  const [form, setForm] = useState({ current_reading: "", previous_reading: "" });
  const [busy, setBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [purchases, setPurchases] = useState([]);
  const [purchaseForm, setPurchaseForm] = useState({ item_name: "", category: "", purchase_price: "", purchase_date: today() });
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseQuery, setPurchaseQuery] = useState("");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  useEffect(() => {
    loadReadings();
    loadPurchases();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ledger-theme", theme);
  }, [theme]);

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
    else setReadings((data ?? []).map((reading) => ({ ...reading, meter_name: meterName(reading.meter_name) })));
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
      reading_date: today(),
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Reading saved.");
      setForm({ current_reading: current, previous_reading: previous });
      loadReadings();
    }
  }

  async function clearReadings() {
    if (!window.confirm("Clear all meter history and reset every meter to zero units?")) return;

    setClearBusy(true);
    setMessage("");
    const baselines = meters.map((meter) => {
      const current = Number(meter.latest?.current_reading ?? 0);
      return { meter_name: meter.name, current_reading: current, previous_reading: current, reading_date: today() };
    });

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("electricity_meter_readings")
        .insert(baselines)
        .select("id");
      if (insertError) throw insertError;

      if (readings.length) {
        const { error: deleteError } = await supabase
          .from("electricity_meter_readings")
          .delete()
          .in("id", readings.map((reading) => reading.id));
        if (deleteError) {
          if (inserted?.length) await supabase.from("electricity_meter_readings").delete().in("id", inserted.map((reading) => reading.id));
          throw deleteError;
        }
      }

      setMessage("All meters reset to zero units.");
      await loadReadings();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setClearBusy(false);
    }
  }

  async function loadPurchases() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("id,item_name,category,purchase_price,purchase_date,created_at")
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPurchases(data ?? []);
    } catch (error) {
      setPurchaseMessage(error.message);
    }
  }

  async function savePurchase(event) {
    event.preventDefault();
    const price = Number(purchaseForm.purchase_price);
    if (!purchaseForm.item_name.trim() || !purchaseForm.category.trim() || !Number.isInteger(price) || price < 0) {
      setPurchaseMessage("Add an item name, category, and whole purchase price.");
      return;
    }
    setPurchaseBusy(true);
    try {
      const values = {
        item_name: purchaseForm.item_name.trim(),
        category: purchaseForm.category.trim(),
        purchase_price: price,
        purchase_date: purchaseForm.purchase_date,
      };
      const { error } = editingPurchase
        ? await supabase.from("purchases").update(values).eq("id", editingPurchase)
        : await supabase.from("purchases").insert(values);
      if (error) throw error;
      setPurchaseForm({ item_name: "", category: "", purchase_price: "", purchase_date: today() });
      setEditingPurchase(null);
      setPurchaseMessage(editingPurchase ? "Purchase updated." : "Purchase saved.");
      setPurchaseDialogOpen(false);
      loadPurchases();
    } catch (error) {
      setPurchaseMessage(error.message);
    } finally {
      setPurchaseBusy(false);
    }
  }

  function editPurchase(purchase) {
    setEditingPurchase(purchase.id);
    setPurchaseForm({
      item_name: purchase.item_name,
      category: purchase.category ?? "",
      purchase_price: String(purchase.purchase_price),
      purchase_date: purchase.purchase_date,
    });
    setPurchaseMessage("");
    setPurchaseDialogOpen(true);
  }

  function cancelPurchaseEdit() {
    setEditingPurchase(null);
    setPurchaseForm({ item_name: "", category: "", purchase_price: "", purchase_date: today() });
    setPurchaseMessage("");
  }

  async function deletePurchase(purchase) {
    if (!window.confirm(`Delete ${purchase.item_name}?`)) return;
    setPurchaseBusy(true);
    try {
      const { error } = await supabase.from("purchases").delete().eq("id", purchase.id);
      if (error) throw error;
      if (editingPurchase === purchase.id) cancelPurchaseEdit();
      setPurchaseMessage("Purchase deleted.");
      loadPurchases();
    } catch (error) {
      setPurchaseMessage(error.message);
    } finally {
      setPurchaseBusy(false);
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

  const navigation = [
    { id: "home", label: "Home", icon: HomeIcon },
    { id: "electricity", label: "Electricity", icon: BoltIcon },
    { id: "purchases", label: "Purchases", icon: BagIcon },
    { id: "more", label: "More", icon: MoreIcon },
  ];

  return (
    <main className="appShell">
      {screen === "home" ? <Home meters={meters} purchases={purchases} onNavigate={setScreen} /> : screen === "readings" ? <Readings readings={readings} busy={clearBusy} message={message} onBack={() => setScreen("electricity")} onClear={clearReadings} /> : screen === "purchases" ? <Purchases
        purchases={purchases}
        form={purchaseForm}
        query={purchaseQuery}
        busy={purchaseBusy}
        message={purchaseMessage}
        editingPurchase={editingPurchase}
        dialogOpen={purchaseDialogOpen}
        setForm={setPurchaseForm}
        setQuery={setPurchaseQuery}
        setDialogOpen={setPurchaseDialogOpen}
        onSubmit={savePurchase}
        onEdit={editPurchase}
        onCancelEdit={cancelPurchaseEdit}
        onDelete={deletePurchase}
      /> : screen === "more" ? <More theme={theme} onThemeChange={setTheme} /> : <>
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
            <span className="readingControl">
              <button type="button" aria-label="Decrease current reading" onClick={() => stepReading("current_reading", -1)}>−</button>
              <input className="meterInput" type="number" min="0" step="1" required value={form.current_reading} onChange={(event) => setForm({ ...form, current_reading: event.target.value })} />
              <button type="button" aria-label="Increase current reading" onClick={() => stepReading("current_reading", 1)}>+</button>
            </span>
          </label>
          <label>
            Previous
            <input className="previousInput" type="number" min="0" step="1" required value={form.previous_reading} onChange={(event) => setForm({ ...form, previous_reading: event.target.value })} />
          </label>
        </div>
        <button type="submit" disabled={busy}>{busy ? "Saving..." : "Save reading"}</button>
        {message && <p className="message">{message}</p>}
      </form>

      <section className="history" aria-label="Recent readings">
        <div className="historyHead">
          <h2>Recent</h2>
          <button className="textButton" type="button" onClick={() => setScreen("readings")}>See all</button>
        </div>
        {readings.length ? readings.slice(0, 3).map((reading) => <ReadingRow key={reading.id} reading={reading} />) : <p className="emptyState">Your saved meter readings will appear here.</p>}
      </section>
      </>}
      <nav className="bottomNav" aria-label="Primary navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            className={screen === id || (screen === "readings" && id === "electricity") ? "active" : ""}
            type="button"
            key={id}
            aria-current={screen === id || (screen === "readings" && id === "electricity") ? "page" : undefined}
            onClick={() => setScreen(id)}
          >
            <span className="navIcon"><Icon /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function ReadingRow({ reading }) {
  return <article>
    <span>{reading.meter_name}</span>
    <strong>{unitsFor(reading.current_reading, reading.previous_reading)} units</strong>
    <time>{formatRecentDate(reading.created_at ?? reading.reading_date)}</time>
  </article>;
}

function Readings({ readings, busy, message, onBack, onClear }) {
  return <>
    <header className="listMast">
      <button className="backButton" type="button" onClick={onBack} aria-label="Back to meters">←</button>
      <div><p className="eyebrow">Meter ledger</p><h1>All readings</h1></div>
      <span>{readings.length}</span>
    </header>
    <section className="history allReadings" aria-label="All meter readings">
      <div className="allReadingsHead">
        <h2>History</h2>
        <button className="clearButton" type="button" disabled={busy} onClick={onClear}>{busy ? "Clearing…" : "Clear entries"}</button>
      </div>
      {message && <p className="message" aria-live="polite">{message}</p>}
      {readings.length ? readings.map((reading) => <ReadingRow key={reading.id} reading={reading} />) : <p className="emptyState">No meter readings saved yet.</p>}
    </section>
  </>;
}

function HomeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M9 20v-6h6v6" /></svg>;
}

function BoltIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m13.5 2-8 12h6l-1 8 8-12h-6Z" /></svg>;
}

function BagIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l1 12H4Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
}

function MoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
}

function Home({ meters, purchases, onNavigate }) {
  const totalUnits = meters.reduce((sum, meter) => sum + meter.units, 0);
  return <>
    <header className="mast homeMast">
      <div><p className="eyebrow">Personal ledger</p><h1>Everything,<br /><span>accounted for.</span></h1></div>
    </header>
    <section className="homeGrid" aria-label="Ledger overview">
      <button type="button" onClick={() => onNavigate("electricity")}>
        <span className="overviewIcon"><BoltIcon /></span><small>Electricity</small><strong>{totalUnits}</strong><span>units across {meters.length} meters</span>
      </button>
      <button type="button" onClick={() => onNavigate("purchases")}>
        <span className="overviewIcon"><BagIcon /></span><small>Purchases</small><strong>{purchases.length}</strong><span>items in your ledger</span>
      </button>
    </section>
  </>;
}

function More({ theme, onThemeChange }) {
  return <section className="morePanel">
    <div className="moreIntro"><span className="overviewIcon"><MoreIcon /></span><div><p className="eyebrow">Appearance</p><h1>Set the mood.</h1><p>Choose a finish for your personal ledger.</p></div></div>
    <div className="themeGrid" role="radiogroup" aria-label="App theme">
      {themes.map((item) => <button className={`themeCard${theme === item.id ? " active" : ""}`} type="button" role="radio" aria-checked={theme === item.id} key={item.id} onClick={() => onThemeChange(item.id)}>
        <span className="themePreview" style={{ "--swatch-bg": item.colors[0], "--swatch-accent": item.colors[1] }}><i /><i /><i /></span>
        <span><strong>{item.name}</strong><small>{item.note}</small></span>
        <i className="themeCheck" aria-hidden="true">✓</i>
      </button>)}
    </div>
  </section>;
}

function PencilIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>;
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function PlusIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
}

function Purchases({ purchases, form, query, busy, message, editingPurchase, dialogOpen, setForm, setQuery, setDialogOpen, onSubmit, onEdit, onCancelEdit, onDelete }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(purchases.map((purchase) => purchase.category).filter(Boolean))];
  const matching = purchases.filter((purchase) => {
    const matchesQuery = `${purchase.item_name} ${purchase.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (category === "All" || purchase.category === category);
  });
  const total = purchases.reduce((sum, purchase) => sum + Number(purchase.purchase_price), 0);
  const closeDialog = () => {
    setDialogOpen(false);
    onCancelEdit();
  };
  return <>
    <header className="mast purchaseMast">
      <div>
        <p className="eyebrow">Purchase ledger</p>
        <h1>{currency.format(total)}</h1>
        <p className="mastNote">{purchases.length ? `${purchases.length} item${purchases.length === 1 ? "" : "s"} on record` : "Your considered collection starts here"}</p>
      </div>
      <span className="purchaseCount">{purchases.length}</span>
    </header>

    <section className="history purchaseHistory" aria-label="Purchase history">
      <div className="collectionHead"><div><p className="eyebrow">Inventory</p><h2>Collection</h2></div><label className="search"><span className="srOnly">Search purchases</span><input type="search" placeholder="Find an item" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      <div className="categoryFilters" aria-label="Filter by category">{categories.map((item) => <button className={item === category ? "active" : ""} type="button" key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {message && !dialogOpen && <p className="message" aria-live="polite">{message}</p>}
      {matching.length ? <div className="purchaseCards">{matching.map((purchase) => <article className="purchaseCard" key={purchase.id}>
        <div className="purchaseCardHead"><b>{purchase.item_name}</b><strong>{currency.format(purchase.purchase_price)}</strong></div>
        <div className="purchaseMeta"><span className="categoryTag">{purchase.category}</span><time>{new Date(`${purchase.purchase_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></div>
        <div className="purchaseActions"><button className="iconButton" type="button" aria-label={`Edit ${purchase.item_name}`} title="Edit purchase" onClick={() => onEdit(purchase)} disabled={busy}><PencilIcon /></button><button className="iconButton deleteButton" type="button" aria-label={`Delete ${purchase.item_name}`} title="Delete purchase" onClick={() => onDelete(purchase)} disabled={busy}><TrashIcon /></button></div>
      </article>)}</div> : <p className="emptyState">{purchases.length ? "No items match these filters." : "Add your first gadget to build your purchase history."}</p>}
    </section>

    <Dialog.Root open={dialogOpen} onOpenChange={(open) => open ? setDialogOpen(true) : closeDialog()}>
      <Dialog.Trigger asChild><button className="purchaseFab" type="button" aria-label="Add purchase" onClick={onCancelEdit}><PlusIcon /></button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
        <Dialog.Content className="purchaseDialog">
          <div className="dialogHead"><div><p className="eyebrow">{editingPurchase ? "Edit purchase" : "New purchase"}</p><Dialog.Title>{editingPurchase ? "Update purchase" : "Add to collection"}</Dialog.Title><Dialog.Description>Keep the details simple — you can edit them later.</Dialog.Description></div><Dialog.Close className="dialogClose" aria-label="Close"><CloseIcon /></Dialog.Close></div>
          <form className="purchaseForm" onSubmit={onSubmit}>
            <label>Item name<input type="text" required autoComplete="off" autoFocus placeholder="e.g. Sony WH-1000XM5" value={form.item_name} onChange={(event) => setForm({ ...form, item_name: event.target.value })} /></label>
            <label>Category<input type="text" required list="purchase-categories" autoComplete="off" placeholder="Choose or enter a category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
            <datalist id="purchase-categories">{purchaseCategories.map((item) => <option key={item} value={item} />)}</datalist>
            <div className="purchaseFields"><label>Price (PKR)<input type="number" required min="0" step="1" inputMode="numeric" placeholder="0" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} /></label><label>Date purchased<input type="date" required value={form.purchase_date} onChange={(event) => setForm({ ...form, purchase_date: event.target.value })} /></label></div>
            <div className="purchaseFormActions"><button type="submit" disabled={busy}>{busy ? "Saving..." : editingPurchase ? "Save changes" : "Save purchase"}</button><button className="secondaryButton" type="button" onClick={closeDialog} disabled={busy}>Cancel</button></div>
            {message && <p className="message" aria-live="polite">{message}</p>}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
