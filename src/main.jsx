import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Limelight } from "@getlimelight/sdk";
import { Archive, CalendarDays, ChevronDown, History, Home as HomeNavIcon, NotebookPen, Pencil, RefreshCw, RotateCcw, Search, Settings, Sparkles, Timer, Trash2, Users, Zap } from "lucide-react";
import { AnimatedToastStack, useAnimatedToastStack } from "@/components/motion/animated-toast-stack";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Dock, DockItem } from "@/components/motion/dock";
import { Loader } from "@/components/motion/loader";
import { Input } from "@/components/motion/input";
import { RangeSlider } from "@/components/motion/range-slider";
import { NumberTicker } from "@/components/motion/number-ticker";
import ElectricBorder from "@/components/ElectricBorder";
import DarkVeil from "@/components/DarkVeil";
import { Aurora } from "@/components/motion/aurora";
import { SideRays } from "@/components/motion/side-rays";
import { ShaderBackground } from "./components/motion/shader-background";
import { bandFor, cycleDays, cyclesFor, isUnusedCycle, readingDeltas, unitsFor, unitsPerDay } from "./electricity.js";
import { supabase } from "./supabase";
import { TimeTracker } from "./time-tracker";
import { createRandomTheme, createThemeVariants, generatedThemeTokens } from "./theme-generator";
import "./styles.css";

const Silk = lazy(() => import("./components/motion/silk"));

Limelight.connect();

const defaultMeters = ["old-modern", "old-classic", "new - 1", "sim-meter"];
const renamedMeters = { "Main meter": "old-modern", "Upstairs meter": "old-classic", "Backup meter": "new - 1" };
const meterName = (name) => renamedMeters[name] ?? name;
const meterLabel = (name) => ({ "old-modern": "Modern meter", "old-classic": "Classic meter", "new - 1": "New meter 1", "sim-meter": "Sim meter" })[name] ?? name;
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const formatCycleDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const purchaseCategories = ["Mobile", "Laptop", "PC", "TWS earbuds", "Smartwatch", "Tablet", "Camera", "Gaming"];
const currency = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
const formatCurrency = (value) => currency.format(value);
const formatWorkdayTarget = () => "8:00";
const SLAB_LIMIT = 200;
const GAUGE_MAX = 220;

function AppNumber({ value, ...props }) {
  return <NumberTicker value={Number(value) || 0} duration={0.55} {...props} />;
}

const themes = [
  { id: "ledger", name: "Ledger", note: "Moss & brass", colors: ["oklch(0.159 0.012 154)", "oklch(0.766 0.143 88)"], shaderColors: ["#101412", "#f0c448"] },
  { id: "ruby", name: "Ruby", note: "Coal & pomegranate", colors: ["oklch(0.145 0.018 25)", "oklch(0.72 0.165 25)"], shaderColors: ["#110707", "#fb756e"] },
  { id: "tide", name: "Volt", note: "Carbon & chartreuse", colors: ["oklch(0.157 0.025 125)", "oklch(0.811 0.178 119)"], shaderColors: ["#0d110b", "#a2d729"] },
  { id: "iris", name: "Iris", note: "Night & soft periwinkle", colors: ["oklch(0.145 0.025 275)", "oklch(0.78 0.105 285)"], shaderColors: ["#070915", "#b0aef8"] },
  { id: "slate", name: "Slate", note: "Blue-gray & ice", colors: ["oklch(0.15 0.012 245)", "oklch(0.8 0.075 235)"], shaderColors: ["#070c10", "#8ec6e7"] },
  { id: "sienna", name: "Sienna", note: "Espresso & apricot", colors: ["oklch(0.16 0.026 35)", "oklch(0.76 0.13 48)"], shaderColors: ["#170906", "#f49665"] },
  { id: "lagoon", name: "Lagoon", note: "Deep sea & aqua", colors: ["oklch(0.145 0.025 195)", "oklch(0.77 0.105 190)"], shaderColors: ["#000d0d", "#55cac3"] },
  { id: "quartz", name: "Quartz", note: "Graphite & champagne", colors: ["oklch(0.15 0.008 85)", "oklch(0.82 0.055 85)"], shaderColors: ["#0d0b08", "#d5c29c"] },
];
const loadThemes = () => {
  try {
    const savedThemes = JSON.parse(localStorage.getItem("ledger-custom-themes") ?? "{}");
    return themes.map((item) => {
      const saved = savedThemes[item.id];
      if (!saved?.custom || !saved?.style || typeof saved.name !== "string") return item;
      return saved.version === 4 ? { ...item, ...saved, id: item.id } : createRandomTheme({ id: item.id, name: saved.name });
    });
  } catch {
    return themes;
  }
};
const backgrounds = [
  { id: "mesh", name: "Mesh", note: "Soft and fluid" },
  { id: "silk", name: "Silk", note: "Woven light" },
  { id: "veil", name: "Dark Veil", note: "Silken aurora" },
  { id: "aurora", name: "Aurora", note: "Northern glow" },
  { id: "rays", name: "Rays", note: "Prismatic light" },
  { id: "dusk", name: "Static Mesh", note: "Dusk" },
  { id: "water", name: "Water", note: "Liquid light" },
  { id: "neuro", name: "Neuro", note: "Living noise" },
];
const navigationItems = [
  { id: "home", label: "Home", screen: "home", icon: HomeNavIcon },
  { id: "time", label: "Time tracker", screen: "time", icon: Timer },
  { id: "electricity", label: "Electricity", screen: "electricity", icon: Zap },
  { id: "stash", label: "Personal stash", screen: "purchases", icon: Archive },
  { id: "settings", label: "Settings", screen: "appearance", icon: Settings },
];
const relativeDay = (value, now = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffHours = Math.floor((now - date) / 36e5);
  const diffDays = Math.floor(diffHours / 24);
  return diffHours < 24 ? `${Math.max(1, diffHours)}hr ago` : diffDays === 1 ? "yesterday" : `${diffDays} days ago`;
};
const formatRecentDate = (value, now = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const relative = relativeDay(value, now);
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = date.getHours() < 12 ? "AM" : "PM";
  const day = String(date.getDate()).padStart(2, "0");

  return `${relative} at ${hours}:${minutes} ${ampm} ${day}-${monthNames[date.getMonth()]}`;
};

function App() {
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({ limit: 4 });
  const [screen, setScreen] = useState("home");
  const [themeOptions, setThemeOptions] = useState(loadThemes);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("ledger-theme");
    return themes.some(({ id }) => id === savedTheme) ? savedTheme : "ledger";
  });
  const [background, setBackground] = useState(() => {
    const savedBackground = localStorage.getItem("ledger-background");
    if (savedBackground === "warp") return "dusk";
    return backgrounds.some(({ id }) => id === savedBackground) ? savedBackground : "mesh";
  });
  const [readings, setReadings] = useState([]);
  const [readingsLoading, setReadingsLoading] = useState(true);
  const [activeMeter, setActiveMeter] = useState(defaultMeters[2]);
  const [readingValue, setReadingValue] = useState("0");
  const [busy, setBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState({ current_reading: "", reading_date: today() });
  const [cycleBusy, setCycleBusy] = useState(false);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [purchaseForm, setPurchaseForm] = useState({ item_name: "", category: "", purchase_price: "", purchase_date: today() });
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseQuery, setPurchaseQuery] = useState("");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  useEffect(() => {
    loadReadings();
    loadPurchases();
  }, []);

  useEffect(() => {
    const selectedTheme = themeOptions.find(({ id }) => id === theme);
    generatedThemeTokens.forEach((token) => document.documentElement.style.removeProperty(token));
    if (selectedTheme?.style) Object.entries(selectedTheme.style).forEach(([token, value]) => document.documentElement.style.setProperty(token, value));
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ledger-theme", theme);
  }, [theme, themeOptions]);

  useEffect(() => {
    const customThemes = Object.fromEntries(themeOptions.filter(({ custom }) => custom).map((item) => [item.id, item]));
    localStorage.setItem("ledger-custom-themes", JSON.stringify(customThemes));
  }, [themeOptions]);

  useEffect(() => {
    localStorage.setItem("ledger-background", background);
  }, [background]);

  const meters = useMemo(() => {
    const names = [...new Set([...defaultMeters, ...readings.map((reading) => reading.meter_name)])];
    return names.map((name) => {
      const cycles = cyclesFor(readings.filter((reading) => reading.meter_name === name));
      const cycle = cycles.find(({ live }) => live);
      const units = cycle?.units ?? 0;
      return { name, cycles, cycle, latest: cycle?.latest ?? null, units, band: cycle ? bandFor(units) : "empty" };
    });
  }, [readings]);

  const activeMeterData = meters.find((meter) => meter.name === activeMeter);
  const activeCycle = activeMeterData?.cycle;
  const activeUnits = activeMeterData?.units ?? 0;
  const readingPrevious = Number(activeCycle?.startReading ?? 0);
  const readingCurrent = Number(activeCycle?.latest?.current_reading ?? readingPrevious);
  const cycleStart = activeCycle?.startDate ?? today();
  const cycleLength = cycleDays(cycleStart, today());
  const sliderValue = Number(readingValue);
  const selectedUnits = Number.isFinite(sliderValue) ? unitsFor(sliderValue, readingPrevious) : 0;

  useEffect(() => {
    setReadingValue(String(readingCurrent));
  }, [activeMeter, readingCurrent]);

  async function loadReadings() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("electricity_meter_readings")
      .select("id,meter_name,current_reading,previous_reading,units,reading_date,cycle_start_date,created_at")
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setReadings((data ?? []).map((reading) => ({ ...reading, meter_name: meterName(reading.meter_name) })));
    setReadingsLoading(false);
  }

  async function saveReading(event) {
    event.preventDefault();
    const previous = readingPrevious;
    const current = Number(readingValue);

    if (!Number.isInteger(current) || current < readingPrevious) {
      setMessage(`Current reading must be a whole number of ${readingPrevious} or more.`);
      return;
    }

    const toastId = showToast({
      title: "Adding meter units…",
      description: `${selectedUnits} units for ${activeMeter}`,
      status: "loading",
      duration: 0,
      dismissible: false,
    });
    setBusy(true);
    const { error } = await supabase.from("electricity_meter_readings").insert({
      meter_name: activeMeter,
      current_reading: current,
      previous_reading: previous,
      reading_date: today(),
      cycle_start_date: cycleStart,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      updateToast(toastId, { title: "Meter update failed", description: error.message, status: "error", duration: 5200, dismissible: true });
    } else {
      setMessage("Units updated.");
      updateToast(toastId, { title: "Meter units added", description: `${selectedUnits} units recorded for ${activeMeter}.`, status: "success", icon: <Zap />, duration: 4200, dismissible: true });
      setReadingModalOpen(false);
      loadReadings();
    }
  }

  function openCycleReset() {
    setMessage("");
    setCycleForm({ current_reading: String(readingCurrent), reading_date: today() });
    setCycleModalOpen(true);
  }

  async function startCycle(event) {
    event.preventDefault();
    const baseline = Number(cycleForm.current_reading);
    const startedOn = cycleForm.reading_date;

    if (!Number.isInteger(baseline) || baseline < 0) {
      setMessage("Billed reading must be a whole number.");
      return;
    }

    const correcting = isUnusedCycle(activeCycle);
    const toastId = showToast({
      title: correcting ? "Updating cycle start…" : "Starting new cycle…",
      description: `${meterLabel(activeMeter)} from ${baseline}`,
      status: "loading",
      duration: 0,
      dismissible: false,
    });
    setCycleBusy(true);
    const values = { meter_name: activeMeter, current_reading: baseline, previous_reading: baseline, reading_date: startedOn, cycle_start_date: startedOn };
    const { error } = correcting
      ? await supabase.from("electricity_meter_readings").update(values).eq("id", activeCycle.latest.id)
      : await supabase.from("electricity_meter_readings").insert(values);
    setCycleBusy(false);

    if (error) {
      setMessage(error.message);
      updateToast(toastId, { title: "Could not start the cycle", description: error.message, status: "error", duration: 5200, dismissible: true });
    } else {
      setMessage(correcting ? "Cycle start updated." : "New billing cycle started.");
      updateToast(toastId, { title: correcting ? "Cycle start updated" : "New cycle started", description: `${meterLabel(activeMeter)} counts from ${baseline} on ${formatCycleDate(startedOn)}.`, status: "success", icon: <RotateCcw />, duration: 4200, dismissible: true });
      setCycleModalOpen(false);
      loadReadings();
    }
  }

  async function clearReadings() {
    if (!window.confirm("Delete every past cycle and restart all meters from their current reading?")) return;

    setClearBusy(true);
    setMessage("");
    const baselines = meters.map((meter) => {
      const current = Number(meter.latest?.current_reading ?? 0);
      return { meter_name: meter.name, current_reading: current, previous_reading: current, reading_date: today(), cycle_start_date: today() };
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
    } finally {
      setPurchasesLoading(false);
    }
  }

  async function savePurchase(event) {
    event.preventDefault();
    const price = Number(purchaseForm.purchase_price);
    if (!purchaseForm.item_name.trim() || !purchaseForm.category.trim() || !Number.isInteger(price) || price < 0) {
      setPurchaseMessage("Add an item name, category, and whole purchase price.");
      return;
    }
    const itemName = purchaseForm.item_name.trim();
    const isEditing = Boolean(editingPurchase);
    const toastId = showToast({
      title: isEditing ? "Updating purchase…" : "Adding purchase…",
      description: itemName,
      status: "loading",
      duration: 0,
      dismissible: false,
    });
    setPurchaseBusy(true);
    try {
      const values = {
        item_name: itemName,
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
      setPurchaseMessage(isEditing ? "Purchase updated." : "Purchase saved.");
      updateToast(toastId, { title: isEditing ? "Purchase updated" : "Purchase added", description: `${itemName} · ${currency.format(price)}`, status: "success", icon: <Archive />, duration: 4200, dismissible: true });
      setPurchaseModalOpen(false);
      loadPurchases();
    } catch (error) {
      setPurchaseMessage(error.message);
      updateToast(toastId, { title: isEditing ? "Purchase update failed" : "Purchase could not be added", description: error.message, status: "error", duration: 5200, dismissible: true });
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
    setPurchaseModalOpen(true);
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

  return (
    <>
    <AppBackground background={background} theme={theme} themes={themeOptions} />
    <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="top-center" fixed maxVisible={3} className="pt-[env(safe-area-inset-top)]" />
    <main className={`appShell${screen === "time" ? " timeMode" : ""}`}>
      {screen === "home" ? <Home meters={meters} purchases={purchases} readings={readings} onNavigate={setScreen} /> : screen === "time" ? <TimeTracker showToast={showToast} updateToast={updateToast} /> : screen === "readings" ? <Readings meters={meters} readings={readings} busy={clearBusy} message={message} onBack={() => setScreen("electricity")} onClear={clearReadings} /> : screen === "purchases" ? <Purchases
        purchases={purchases}
        loading={purchasesLoading}
        form={purchaseForm}
        query={purchaseQuery}
        busy={purchaseBusy}
        message={purchaseMessage}
        editingPurchase={editingPurchase}
        modalOpen={purchaseModalOpen}
        setForm={setPurchaseForm}
        setQuery={setPurchaseQuery}
        setModalOpen={setPurchaseModalOpen}
        onSubmit={savePurchase}
        onEdit={editPurchase}
        onCancelEdit={cancelPurchaseEdit}
        onDelete={deletePurchase}
      /> : screen === "appearance" ? <More themes={themeOptions} theme={theme} background={background} onThemeChange={setTheme} onThemeGenerated={(nextTheme) => setThemeOptions((items) => items.map((item) => item.id === nextTheme.id ? nextTheme : item))} onBackgroundChange={setBackground} /> : screen === "notes" ? <MiniAppPlaceholder title="Personal notes" note="A private place for quick thoughts, lists, and things worth remembering." icon={<NotebookPen />} /> : screen === "teams" ? <MiniAppPlaceholder title="Teams" note="Your shared spaces and team access will live here." icon={<Users />} /> : <>
      <PageHeader
        trailing={<div className="pageHeaderActions">
          <button className="pageIconButton" type="button" aria-label="Start a new billing cycle" title="New billing cycle" onClick={openCycleReset}><RotateCcw /></button>
          <button className="pageIconButton" type="button" aria-label="View meter history" title="Meter history" onClick={() => setScreen("readings")}><History /></button>
          <span className="pageStat"><strong><AppNumber value={activeUnits} /></strong> units</span>
        </div>}
      >
        Power <em>usage.</em>
      </PageHeader>

      <p className="cycleStrip">
        {activeCycle
          ? <>From <strong>{activeCycle.startReading}</strong> on <strong>{formatCycleDate(activeCycle.startDate)}</strong> · <strong>{cycleLength}</strong> {cycleLength === 1 ? "day" : "days"} in{cycleLength ? <> · <strong>{unitsPerDay(activeUnits, cycleLength)}</strong> units a day</> : null}</>
          : <>No cycle yet for {meterLabel(activeMeter)} — start one from the reading on your bill.</>}
      </p>
      {message && !readingModalOpen && !cycleModalOpen && <p className="message" aria-live="polite">{message}</p>}

      <section className="limitGauge" data-band={bandFor(activeUnits)} aria-label="Slab headroom">
        <div className="limitGaugeHead">
          <span>{activeUnits < SLAB_LIMIT ? <><strong>{SLAB_LIMIT - activeUnits}</strong> units left before the {SLAB_LIMIT} slab</> : <><strong>{activeUnits - SLAB_LIMIT}</strong> units past the {SLAB_LIMIT} slab</>}</span>
          <b>{activeUnits}<i>/{GAUGE_MAX}</i></b>
        </div>
        <div className="limitGaugeTrack">
          <i style={{ "--fill": Math.min(1, activeUnits / GAUGE_MAX) }} />
          <b style={{ "--at": `${(SLAB_LIMIT / GAUGE_MAX) * 100}%` }}><span>{SLAB_LIMIT}</span></b>
        </div>
      </section>

      <section className="meterCabinet" aria-label="Electricity meters">
        <MeterGroup title="Included meters">
          <div className="meterPair">
            {meters.filter((meter) => meter.name.startsWith("old-")).map((meter) => <MeterCard key={meter.name} meter={meter} activeMeter={activeMeter} onSelect={setActiveMeter} />)}
          </div>
        </MeterGroup>
        <MeterGroup current title="New meters">
          <div className="meterPair currentMeters">
            {meters.filter((meter) => !meter.name.startsWith("old-")).map((meter) => <MeterCard key={meter.name} meter={meter} activeMeter={activeMeter} onSelect={setActiveMeter} />)}
          </div>
        </MeterGroup>
      </section>

      {readingsLoading ? <Loader variant="dots" size={18} label="Loading meter readings" className="emptyState text-primary" /> : null}

      <button className="purchaseFab" type="button" aria-label="Update electricity units" onClick={() => { setMessage(""); setReadingValue(String(readingCurrent)); setReadingModalOpen(true); }}><PlusIcon /></button>
      <MorphingModal viewId={readingModalOpen ? "electricity-reading" : null} onClose={() => setReadingModalOpen(false)} placement="top" ariaLabel="Update electricity units" className="ledgerMorphingModal max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="morphingModalHeader">
          <div><h2>Update units</h2><p>{meterLabel(activeMeter)} · cycle started {formatCycleDate(cycleStart)}</p></div>
          <button type="button" aria-label="Close update units form" onClick={() => setReadingModalOpen(false)}>×</button>
        </div>
        <form onSubmit={saveReading}>
          <div className="unitSliderField" data-band={bandFor(selectedUnits)}>
            <div className="readingValueFields">
              <Input label="Current reading" type="number" min={readingPrevious} step="1" inputMode="numeric" required autoFocus value={readingValue} onChange={setReadingValue} classNames={{ field: "currentReadingInputField", input: "currentReadingInput" }} />
              <div className="previousReading"><span>Counting from<button className="cycleChangeButton" type="button" disabled={busy} onClick={() => { setReadingModalOpen(false); openCycleReset(); }}>Change</button></span><output>{readingPrevious}</output></div>
            </div>
            <div className="unitSliderValue" data-band={bandFor(selectedUnits)}><span>Units used</span><strong>{selectedUnits}</strong></div>
            <RangeSlider value={Math.min(200, selectedUnits)} onValueChange={(units) => setReadingValue(String(readingPrevious + units))} min={0} max={200} step={1} tickStep={10} haptic disabled={busy} aria-label="Electricity units used" />
            <div className="unitSliderLimits" aria-hidden="true"><span>0</span><span>200</span></div>
          </div>
          <div className="purchaseFormActions"><button type="submit" disabled={busy}>{busy ? <span className="inline-flex items-center gap-2">Updating <Loader variant="dots" size={14} label="Updating electricity units" /></span> : "Update units"}</button><button className="secondaryButton" type="button" disabled={busy} onClick={() => setReadingModalOpen(false)}>Cancel</button></div>
          {message && <p className="message" aria-live="polite">{message}</p>}
        </form>
      </MorphingModal>
      <MorphingModal viewId={cycleModalOpen ? "electricity-cycle" : null} onClose={() => setCycleModalOpen(false)} placement="top" ariaLabel="Start a new billing cycle" className="ledgerMorphingModal max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="morphingModalHeader">
          <div><h2>New billing cycle</h2><p>{meterLabel(activeMeter)}</p></div>
          <button type="button" aria-label="Close new billing cycle form" onClick={() => setCycleModalOpen(false)}>×</button>
        </div>
        <form onSubmit={startCycle}>
          <div className="cycleResetField">
            <Input label="Reading on your bill" type="number" min="0" step="1" inputMode="numeric" required autoFocus disabled={cycleBusy} value={cycleForm.current_reading} onChange={(current_reading) => setCycleForm({ ...cycleForm, current_reading })} classNames={{ field: "currentReadingInputField", input: "currentReadingInput" }} />
            <Input label="Reading day" type="date" required max={today()} disabled={cycleBusy} value={cycleForm.reading_date} rightIcon={<CalendarDays />} classNames={{ rightIcon: "purchaseDateIcon" }} onChange={(reading_date) => setCycleForm({ ...cycleForm, reading_date })} />
            <p className="cycleResetNote">{isUnusedCycle(activeCycle)
              ? <>Nothing has been logged since {formatCycleDate(cycleStart)}, so this corrects that start instead of stacking a new cycle behind it.</>
              : <>Counting restarts from this reading on the day the company took it. The cycle you are on now is kept in history.</>}</p>
          </div>
          <div className="purchaseFormActions"><button type="submit" disabled={cycleBusy}>{cycleBusy ? <span className="inline-flex items-center gap-2">Starting <Loader variant="dots" size={14} label="Starting new billing cycle" /></span> : "Start cycle"}</button><button className="secondaryButton" type="button" disabled={cycleBusy} onClick={() => setCycleModalOpen(false)}>Cancel</button></div>
          {message && <p className="message" aria-live="polite">{message}</p>}
        </form>
      </MorphingModal>
      </>}
      <AppNavigation screen={screen} onNavigate={setScreen} />
    </main>
    </>
  );
}

function AppNavigation({ screen, onNavigate }) {
  const active = screen === "readings"
    ? "electricity"
    : screen === "purchases"
      ? "stash"
      : screen === "appearance" || screen === "teams"
        ? "settings"
        : screen === "time" || screen === "notes"
          ? "time"
          : screen;

  return <nav className="appNavigation" aria-label="Mini apps">
    <Dock className="appNavigationDock" size={48}>
      {navigationItems.map(({ id, label, screen: nextScreen, icon: Icon }) => (
        <DockItem key={id} active={active === id} aria-current={active === id ? "page" : undefined} aria-label={label} onClick={() => onNavigate(nextScreen)}>
          <Icon className="appNavIcon" />
        </DockItem>
      ))}
    </Dock>
  </nav>;
}

function MiniAppPlaceholder({ title, note, icon }) {
  return <>
    <PageHeader note={note}>{title}<em>.</em></PageHeader>
    <section className="ledgerCard miniAppEmpty">
      <span>{icon}</span>
      <p>This mini app is ready for its next feature.</p>
    </section>
  </>;
}

function AppBackground({ background, theme, themes: themeOptions }) {
  const currentTheme = themeOptions.find(({ id }) => id === theme) ?? themeOptions[0];
  const [base, accent] = currentTheme.shaderColors;
  if (background === "silk") return <div className="shaderBackdrop" aria-hidden="true">
    <Suspense fallback={null}><Silk key={theme} speed={5} scale={1} color={accent} noiseIntensity={1.5} rotation={0} /></Suspense>
  </div>;
  const veilHue = currentTheme.veilHue ?? { ledger: 35, ruby: -45, tide: 75, iris: 0, slate: 15, sienna: -25, lagoon: 45, quartz: 55 }[theme] ?? 0;
  if (background === "veil") return <div className="shaderBackdrop" aria-hidden="true">
    <DarkVeil key={`${theme}-${background}`} hueShift={veilHue} noiseIntensity={0.025} speed={0.22} warpAmount={0.18} resolutionScale={0.8} />
  </div>;
  if (background === "aurora") return <div className="shaderBackdrop" aria-hidden="true">
    <Aurora key={`${theme}-${background}`} colorStops={[base, accent, base]} blend={0.55} amplitude={1.15} speed={0.5} />
  </div>;
  if (background === "rays") return <div className="shaderBackdrop" aria-hidden="true">
    <SideRays key={`${theme}-${background}`} className="shaderCanvas" rayColor1={accent} rayColor2="#96c8ff" />
  </div>;

  const shared = { className: "shaderCanvas" };
  const props = background === "dusk"
    ? { ...shared, variant: "static-mesh-gradient", colors: ["#2b1055", "#7597de", "#f6a1c8", "#0d0221"] }
    : background === "water"
      ? { ...shared, variant: "water", colorBack: "#909090", colorHighlight: "#ffffff", speed: 0.4 }
    : background === "neuro"
      ? { ...shared, variant: "neuro-noise", colorFront: accent, colorMid: base, colorBack: base, brightness: 0.7, contrast: 0.9, speed: 0.16 }
      : { ...shared, variant: "mesh-gradient", colors: [base, accent, base, base], distortion: 0.85, swirl: 0.55, grainOverlay: 0.08, speed: 0.16 };

  return <div className="shaderBackdrop" aria-hidden="true"><ShaderBackground key={`${theme}-${background}`} {...props} /></div>;
}

function MeterGroup({ title, current = false, children }) {
  return <section className={`meterGroup${current ? " current" : ""}`}>
    <header className="meterGroupHead">
      <h2>{title}</h2>
    </header>
    {children}
  </section>;
}

function MeterCard({ meter, activeMeter, onSelect }) {
  const active = meter.name === activeMeter;
  const card = <button
    className={active ? `ledgerCard meterCard active ${meter.band}` : `ledgerCard meterCard ${meter.band}`}
    type="button"
    aria-pressed={active}
    onClick={() => onSelect(meter.name)}
  >
    <span className="meterCardTop"><span>{meterLabel(meter.name)}</span></span>
    <strong>{meter.latest ? meter.units : <span className="noValue">—</span>}<small> units</small></strong>
    <span className="meterReading">{meter.cycle ? `${meter.cycle.latest.current_reading} now · since ${formatCycleDate(meter.cycle.startDate)}` : "No reading yet"}</span>
  </button>;

  return active
    ? <ElectricBorder color="var(--accent)" speed={0.7} chaos={0.08} borderRadius={18} className="meterElectricBorder">{card}</ElectricBorder>
    : card;
}

function PageHeader({ children, note, leading, trailing, stacked = false }) {
  return <header className={`pageMast${leading ? " hasLeading" : ""}${stacked ? " stacked" : ""}`}>
    {leading}
    <div className="pageMastCopy">
      <div className="pageMastTitleRow">
        <h1>{children}</h1>
        {trailing ? <div className="pageMastTrailing">{trailing}</div> : null}
      </div>
      {note ? <p className="pageMastNote">{note}</p> : null}
    </div>
  </header>;
}

function Readings({ meters, readings, busy, message, onBack, onClear }) {
  const tracked = meters.filter((meter) => meter.cycles.length);
  return <>
    <PageHeader
      leading={<button className="pageIconButton" type="button" onClick={onBack} aria-label="Back to meters">←</button>}
      trailing={<span className="pageCount"><AppNumber value={readings.length} /></span>}
    >
      Billing <em>cycles.</em>
    </PageHeader>
    <section className="history allReadings" aria-label="Meter billing cycles">
      <div className="allReadingsHead">
        <h2>History</h2>
        <button className="clearButton" type="button" disabled={busy} onClick={onClear}>{busy ? <span className="inline-flex items-center gap-2">Clearing <Loader variant="dots" size={12} label="Clearing meter readings" /></span> : "Clear entries"}</button>
      </div>
      {message && <p className="message" aria-live="polite">{message}</p>}
      {tracked.length ? tracked.map((meter) => <section className="cycleMeter" key={meter.name}>
        <h3>{meterLabel(meter.name)}</h3>
        {meter.cycles.map((cycle, index) => <CycleCard key={`${meter.name}-${cycle.startDate}`} cycle={cycle} current={Boolean(cycle.live)} endedOn={meter.cycles[index - 1]?.startDate} />)}
      </section>) : <p className="emptyState">No meter readings saved yet.</p>}
    </section>
  </>;
}

function CycleCard({ cycle, current, endedOn }) {
  const [open, setOpen] = useState(current);
  const closedOn = endedOn ?? (current ? null : cycle.latest.reading_date);
  const days = cycleDays(cycle.startDate, closedOn ?? today());
  return <article className={`ledgerCard cycleCard ${bandFor(cycle.units)}`}>
    <button className="cycleCardHead" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span className="cycleRange">{formatCycleDate(cycle.startDate)} → {closedOn ? formatCycleDate(closedOn) : "now"}{current ? <b>Running</b> : null}</span>
      <strong>{cycle.units}<small> units</small></strong>
      <span className="cycleMeta">{cycle.startReading} → {cycle.latest.current_reading} · {days} {days === 1 ? "day" : "days"}{days ? ` · ${unitsPerDay(cycle.units, days)}/day` : ""}</span>
      <ChevronDown className="cycleChevron" data-open={open ? "true" : "false"} aria-hidden="true" />
    </button>
    {open ? <ul className="cycleEntries">
      {cycle.entries.map((reading) => <li key={reading.id}>
        <span>{reading.current_reading}</span>
        <strong>{unitsFor(reading.current_reading, cycle.startReading)} units</strong>
        <time>{formatRecentDate(reading.created_at ?? reading.reading_date)}</time>
      </li>)}
    </ul> : null}
  </article>;
}

function HomeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M9 20v-6h6v6" /></svg>;
}

function BoltIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m13.5 2-8 12h6l-1 8 8-12h-6Z" /></svg>;
}

function TimeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 3h6" /></svg>;
}

function BagIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l1 12H4Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
}

function MoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
}

function Home({ meters, purchases, readings, onNavigate }) {
  const totalUnits = meters.reduce((sum, meter) => sum + meter.units, 0);
  // Both ledgers already live in state, so the feed is a second reading of
  // what is there rather than another round trip.
  const latest = useMemo(() => {
    const deltas = readingDeltas(readings);
    return [
      ...readings.map((reading) => ({ id: `r-${reading.id}`, at: reading.created_at ?? reading.reading_date, kind: reading.current_reading === reading.previous_reading ? "Cycle start" : "Reading", label: meterLabel(reading.meter_name), value: String(reading.current_reading), delta: deltas.get(reading.id) ?? 0 })),
      ...purchases.map((purchase) => ({ id: `p-${purchase.id}`, at: purchase.created_at ?? purchase.purchase_date, kind: purchase.category || "Purchase", label: purchase.item_name, value: currency.format(purchase.purchase_price) })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4);
  }, [readings, purchases]);

  return <>
    <PageHeader stacked>Everything, <em>accounted for.</em></PageHeader>
    <section className="homeGrid" aria-label="Ledger overview">
      <button className="ledgerCard timeOverview" type="button" onClick={() => onNavigate("time")}>
        <span className="overviewIcon"><TimeIcon /></span><small>Workday</small><strong><AppNumber value={800} format={formatWorkdayTarget} /></strong><span>weekday time target</span>
      </button>
      <button className="ledgerCard" type="button" onClick={() => onNavigate("electricity")}>
        <span className="overviewIcon"><BoltIcon /></span><small>Electricity</small><strong><AppNumber value={totalUnits} /></strong><span>units across <AppNumber value={meters.length} /> meters</span>
      </button>
      <button className="ledgerCard" type="button" onClick={() => onNavigate("purchases")}>
        <span className="overviewIcon"><BagIcon /></span><small>Purchases</small><strong><AppNumber value={purchases.length} /></strong><span>items in your ledger</span>
      </button>
    </section>
    <section className="homeFeed" aria-label="Latest activity">
      <h2>Latest</h2>
      {latest.length ? <ul>
        {latest.map((item) => <li key={item.id}>
          <b>{item.label}</b>
          <strong>{item.value}{item.delta ? <small className="feedDelta">+{item.delta} added</small> : null}</strong>
          <span>{item.kind} · {relativeDay(item.at)}</span>
        </li>)}
      </ul> : <p className="emptyState">Nothing logged yet. Add a meter reading or a purchase to start the ledger.</p>}
    </section>
  </>;
}

function More({ themes, theme, background, onThemeChange, onThemeGenerated, onBackgroundChange }) {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [slotId, setSlotId] = useState(theme);
  const [themeName, setThemeName] = useState(themes.find(({ id }) => id === theme)?.name ?? "New theme");
  const [variants, setVariants] = useState(() => createThemeVariants({ id: theme, name: "New theme" }));
  const [variantIndex, setVariantIndex] = useState(0);
  const draft = variants[variantIndex] ?? variants[0];
  const deal = (item) => {
    setVariants(createThemeVariants(item));
    setVariantIndex(0);
  };
  const openGenerator = () => {
    const item = themes.find(({ id }) => id === theme) ?? themes[0];
    setSlotId(item.id);
    setThemeName(item.name);
    deal(item);
    setGeneratorOpen(true);
  };
  const chooseSlot = (nextId) => {
    const item = themes.find(({ id }) => id === nextId) ?? themes[0];
    setSlotId(item.id);
    setThemeName(item.name);
    deal(item);
  };
  const randomize = () => deal({ id: slotId, name: themeName.trim() || "New theme" });
  const saveTheme = (event) => {
    event.preventDefault();
    const nextTheme = { ...draft, id: slotId, name: themeName.trim() || "New theme" };
    onThemeGenerated(nextTheme);
    onThemeChange(slotId);
    setGeneratorOpen(false);
  };

  return <section className="morePanel">
    <PageHeader note="Choose a background and finish for your personal ledger.">Set the <em>mood.</em></PageHeader>
    <div className="themeHeading"><div><p className="eyebrow">Background</p><h2>Choose your motion</h2></div><span><AppNumber value={backgrounds.length} /> styles</span></div>
    <div className="backgroundGrid" role="radiogroup" aria-label="App background">
      {backgrounds.map((item) => <button className={`ledgerCard backgroundCard ${item.id}${background === item.id ? " active" : ""}`} type="button" role="radio" aria-checked={background === item.id} key={item.id} onClick={() => onBackgroundChange(item.id)}>
        <span className="backgroundPreview" aria-hidden="true"><i /><i /></span>
        <span><strong>{item.name}</strong><small>{item.note}</small></span>
        <span className="themeState" aria-hidden="true"><i className="themeDot" /><i className="themeCheck">✓</i></span>
      </button>)}
    </div>
    <div className="themeHeading"><div><p className="eyebrow">Theme library</p><h2>Pick your atmosphere</h2></div><div className="themeHeadingActions"><span><AppNumber value={themes.length} /> finishes</span><button className="themeGenerateButton" type="button" onClick={openGenerator}><Sparkles aria-hidden="true" /> Generate</button></div></div>
    <div className="themeGrid" role="radiogroup" aria-label="App theme">
      {themes.map((item) => <button className={`ledgerCard themeCard${theme === item.id ? " active" : ""}`} type="button" role="radio" aria-checked={theme === item.id} aria-label={`${item.name}: ${item.note}`} key={item.id} onClick={() => onThemeChange(item.id)}>
        <span className="themePreview" style={{ "--swatch-bg": item.colors[0], "--swatch-accent": item.colors[1] }}><i /><i /><i /></span>
        <span><strong>{item.name}</strong><small>{item.note}</small></span>
        <span className="themeState" aria-hidden="true"><i className="themeDot" /><i className="themeCheck">✓</i></span>
      </button>)}
    </div>
    <MorphingModal viewId={generatorOpen ? "theme-generator" : null} onClose={() => setGeneratorOpen(false)} placement="center" ariaLabel="Generate a random theme" className="ledgerMorphingModal themeGeneratorModal max-w-md">
      <div className="morphingModalHeader">
        <div><h2>Generate a theme</h2><p>Deal six finishes and keep the one you like.</p></div>
        <button type="button" aria-label="Close theme generator" onClick={() => setGeneratorOpen(false)}>×</button>
      </div>
      <form onSubmit={saveTheme}>
        <label>Theme to replace<select value={slotId} onChange={(event) => chooseSlot(event.target.value)}>{themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <Input label="Theme name" value={themeName} onChange={setThemeName} maxLength={24} required autoFocus />
        <div className="generatorThemePreview" aria-live="polite" style={{ "--swatch-bg": draft.colors[0], "--swatch-accent": draft.colors[1] }}>
          <span className="themePreview" aria-hidden="true"><i /><i /><i /></span>
          <div><strong>{themeName.trim() || "New theme"}</strong><small>{draft.note}</small><small className="generatorFinish">{draft.finish} · {draft.harmony}</small></div>
          <div className="generatorPalette" aria-label="Generated palette">{draft.palette.map((color) => <i key={color} style={{ background: color }} />)}</div>
        </div>
        <div className="generatorVariants" role="radiogroup" aria-label="Generated variations">
          {variants.map((item, index) => <button className={`generatorVariant${index === variantIndex ? " active" : ""}`} type="button" role="radio" aria-checked={index === variantIndex} aria-label={`${item.finish}: ${item.note}`} key={`${item.finish}-${item.note}-${index}`} onClick={() => setVariantIndex(index)} style={{ "--swatch-bg": item.colors[0], "--swatch-accent": item.colors[1] }}>
            <span className="themePreview" aria-hidden="true"><i /><i /><i /></span>
          </button>)}
        </div>
        <div className="purchaseFormActions"><button type="submit">Save theme</button><button className="secondaryButton" type="button" onClick={randomize}><RefreshCw aria-hidden="true" /> More variations</button></div>
      </form>
    </MorphingModal>
  </section>;
}

function PlusIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
}

function Purchases({ purchases, loading, form, query, busy, message, editingPurchase, modalOpen, setForm, setQuery, setModalOpen, onSubmit, onEdit, onCancelEdit, onDelete }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(purchases.map((purchase) => purchase.category).filter(Boolean))];
  const formCategories = [...new Set([...purchaseCategories, ...categories.slice(1)])];
  const matching = purchases.filter((purchase) => {
    const matchesQuery = `${purchase.item_name} ${purchase.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (category === "All" || purchase.category === category);
  });
  const total = purchases.reduce((sum, purchase) => sum + Number(purchase.purchase_price), 0);
  const closeModal = () => {
    setModalOpen(false);
    onCancelEdit();
  };
  return <>
    <PageHeader
      note={purchases.length ? <><strong><AppNumber value={total} format={formatCurrency} /></strong> across your collection</> : "Your considered collection starts here"}
      trailing={<span className="pageCount"><AppNumber value={purchases.length} /></span>}
    >
      Your <em>stash.</em>
    </PageHeader>

    <section className="history purchaseHistory" aria-label="Purchase history">
      <div className="collectionHead"><Input className="search" type="search" aria-label="Search your stash" placeholder="Find an item" value={query} onChange={setQuery} leftIcon={<Search />} classNames={{ field: "searchInputField" }} /></div>
      <div className="categoryFilters" aria-label="Filter by category">{categories.map((item) => <button className={item === category ? "active" : ""} type="button" key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {message && !modalOpen && <p className="message" aria-live="polite">{message}</p>}
      {loading ? <Loader variant="dots" size={18} label="Loading purchases" className="emptyState text-primary" /> : matching.length ? <div className="purchaseCards">{matching.map((purchase) => <article className="ledgerCard purchaseCard" key={purchase.id}>
        <div className="purchaseCardHead"><b>{purchase.item_name}</b><strong>{currency.format(purchase.purchase_price)}</strong></div>
        <div className="purchaseMeta"><span className="categoryTag">{purchase.category}</span><time>{new Date(`${purchase.purchase_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></div>
        <div className="purchaseCardActions">
          <button type="button" aria-label={`Edit ${purchase.item_name}`} disabled={busy} onClick={() => onEdit(purchase)}><Pencil /></button>
          <button className="danger" type="button" aria-label={`Delete ${purchase.item_name}`} disabled={busy} onClick={() => onDelete(purchase)}><Trash2 /></button>
        </div>
      </article>)}</div> : <p className="emptyState">{purchases.length ? "No items match these filters." : "Add your first gadget to build your purchase history."}</p>}
    </section>

    <button className="purchaseFab" type="button" aria-label="Add purchase" onClick={() => { onCancelEdit(); setModalOpen(true); }}><PlusIcon /></button>
    <MorphingModal viewId={modalOpen ? editingPurchase ? "purchase-edit" : "purchase-new" : null} onClose={closeModal} placement="top" ariaLabel={editingPurchase ? "Update purchase" : "Add purchase"} className="ledgerMorphingModal max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <div className="morphingModalHeader">
        <div><h2>{editingPurchase ? "Update purchase" : "Add to collection"}</h2><p>Keep the details simple — you can edit them later.</p></div>
        <button type="button" aria-label="Close purchase form" onClick={closeModal}>×</button>
      </div>
      <form className="purchaseForm" onSubmit={onSubmit}>
        <div className="purchaseFormRow">
          <Input label="Item name" type="text" required autoComplete="off" autoFocus placeholder="e.g. Sony WH-1000XM5" value={form.item_name} onChange={(item_name) => setForm({ ...form, item_name })} />
          <Input label="Price (PKR)" type="number" required min="0" step="1" inputMode="numeric" placeholder="0" value={form.purchase_price} onChange={(purchase_price) => setForm({ ...form, purchase_price })} />
        </div>
        <div className="purchaseFormRow">
          <label>Category<select required value={form.category} disabled={busy} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option value="" disabled>Choose a category</option>
            {formCategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <Input label="Date purchased" type="date" required disabled={busy} value={form.purchase_date} rightIcon={<CalendarDays />} classNames={{ rightIcon: "purchaseDateIcon" }} onChange={(purchase_date) => setForm({ ...form, purchase_date })} />
        </div>
        <div className="purchaseFormActions"><button type="submit" disabled={busy}>{busy ? <span className="inline-flex items-center gap-2">Saving <Loader variant="dots" size={14} label="Saving purchase" /></span> : editingPurchase ? "Save changes" : "Save purchase"}</button><button className="secondaryButton" type="button" onClick={closeModal} disabled={busy}>Cancel</button></div>
        {message && <p className="message" aria-live="polite">{message}</p>}
      </form>
    </MorphingModal>
  </>;
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
