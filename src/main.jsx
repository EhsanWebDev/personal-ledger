import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Limelight } from "@getlimelight/sdk";
import { Archive, Home as HomeNavIcon, NotebookPen, Pencil, Settings, Timer, Trash2, Users, Zap } from "lucide-react";
import { AnimatedToastStack, useAnimatedToastStack } from "@/components/motion/animated-toast-stack";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Dock, DockItem } from "@/components/motion/dock";
import { Loader } from "@/components/motion/loader";
import { Input } from "@/components/motion/input";
import { RangeSlider } from "@/components/motion/range-slider";
import { SwipeableList } from "@/components/motion/swipeable-list";
import { NumberTicker } from "@/components/motion/number-ticker";
import { WheelPicker } from "@/components/motion/wheel-picker";
import { ShaderBackground } from "./components/motion/shader-background";
import { bandFor } from "./electricity.js";
import { supabase } from "./supabase";
import { TimeTracker } from "./time-tracker";
import "./styles.css";

Limelight.connect();

const defaultMeters = ["old-modern", "old-classic", "new - 1"];
const renamedMeters = { "Main meter": "old-modern", "Upstairs meter": "old-classic", "Backup meter": "new - 1" };
const meterName = (name) => renamedMeters[name] ?? name;
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const unitsFor = (current, previous) => Math.max(0, Number(current || 0) - Number(previous || 0));
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const datePickerMonths = monthNames.map((label, index) => ({ label, value: String(index + 1).padStart(2, "0") }));
const datePickerYears = Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => String(1900 + index));
const purchaseCategories = ["Mobile", "Laptop", "PC", "TWS earbuds", "Smartwatch", "Tablet", "Camera", "Gaming"];
const currency = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
const formatCurrency = (value) => currency.format(value);
const formatWorkdayTarget = () => "8:00";

function AppNumber({ value, ...props }) {
  return <NumberTicker value={Number(value) || 0} duration={0.55} {...props} />;
}

function DateWheelPicker({ value, onValueChange, disabled }) {
  const [year, month, day] = value.split("-");
  const dayCount = new Date(Number(year), Number(month), 0).getDate();
  const days = useMemo(() => Array.from({ length: dayCount }, (_, index) => ({ label: String(index + 1), value: String(index + 1).padStart(2, "0") })), [dayCount]);
  const update = (part, next) => {
    const nextYear = part === "year" ? next : year;
    const nextMonth = part === "month" ? next : month;
    const lastDay = new Date(Number(nextYear), Number(nextMonth), 0).getDate();
    const nextDay = part === "day" ? next : String(Math.min(Number(day), lastDay)).padStart(2, "0");
    onValueChange(`${nextYear}-${nextMonth}-${nextDay}`);
  };

  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="mb-2 text-[13px] font-bold text-foreground">Date purchased</legend>
      <div className="flex items-stretch gap-1 rounded-2xl border border-border bg-background p-1.5">
        <WheelPicker options={datePickerMonths} value={month} onValueChange={(next) => update("month", next)} disabled={disabled} className="min-w-0 flex-[1.35] border-0 bg-transparent" aria-label="Purchase month" />
        <WheelPicker options={days} value={day} onValueChange={(next) => update("day", next)} disabled={disabled} className="min-w-0 flex-1 border-0 bg-transparent" aria-label="Purchase day" />
        <WheelPicker options={datePickerYears} value={year} onValueChange={(next) => update("year", next)} disabled={disabled} className="min-w-0 flex-1 border-0 bg-transparent" aria-label="Purchase year" />
      </div>
    </fieldset>
  );
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
const backgrounds = [
  { id: "mesh", name: "Mesh", note: "Soft and fluid" },
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
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({ limit: 4 });
  const [screen, setScreen] = useState("home");
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
  const [activeMeter, setActiveMeter] = useState(defaultMeters[0]);
  const [readingValue, setReadingValue] = useState("0");
  const [busy, setBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [readingSheetOpen, setReadingSheetOpen] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [purchaseForm, setPurchaseForm] = useState({ item_name: "", category: "", purchase_price: "", purchase_date: today() });
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [purchaseQuery, setPurchaseQuery] = useState("");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseSheetOpen, setPurchaseSheetOpen] = useState(false);

  useEffect(() => {
    loadReadings();
    loadPurchases();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ledger-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("ledger-background", background);
  }, [background]);

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
  const readingPrevious = Number(activeLatest?.previous_reading ?? 0);
  const readingCurrent = Number(activeLatest?.current_reading ?? readingPrevious);
  const readingMaximum = readingPrevious + 200;
  const sliderValue = Number(readingValue);
  const selectedUnits = Number.isFinite(sliderValue) ? Math.min(200, unitsFor(sliderValue, readingPrevious)) : 0;

  useEffect(() => {
    setReadingValue(String(readingCurrent));
  }, [activeMeter, readingCurrent]);

  async function loadReadings() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("electricity_meter_readings")
      .select("id,meter_name,current_reading,previous_reading,units,reading_date,created_at")
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

    if (!Number.isInteger(current) || current < readingPrevious || current > readingMaximum) {
      setMessage(`Current reading must be a whole number from ${readingPrevious} to ${readingMaximum}.`);
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
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      updateToast(toastId, { title: "Meter update failed", description: error.message, status: "error", duration: 5200, dismissible: true });
    } else {
      setMessage("Units updated.");
      updateToast(toastId, { title: "Meter units added", description: `${selectedUnits} units recorded for ${activeMeter}.`, status: "success", icon: <Zap />, duration: 4200, dismissible: true });
      setReadingSheetOpen(false);
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
      setPurchaseSheetOpen(false);
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
    setPurchaseSheetOpen(true);
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
    <AppBackground background={background} theme={theme} />
    <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="top-center" fixed maxVisible={3} className="pt-[env(safe-area-inset-top)]" />
    <main className={`appShell${screen === "time" ? " timeMode" : ""}`}>
      {screen === "home" ? <Home meters={meters} purchases={purchases} onNavigate={setScreen} /> : screen === "time" ? <TimeTracker showToast={showToast} updateToast={updateToast} /> : screen === "readings" ? <Readings readings={readings} busy={clearBusy} message={message} onBack={() => setScreen("electricity")} onClear={clearReadings} /> : screen === "purchases" ? <Purchases
        purchases={purchases}
        loading={purchasesLoading}
        form={purchaseForm}
        query={purchaseQuery}
        busy={purchaseBusy}
        message={purchaseMessage}
        editingPurchase={editingPurchase}
        sheetOpen={purchaseSheetOpen}
        setForm={setPurchaseForm}
        setQuery={setPurchaseQuery}
        setSheetOpen={setPurchaseSheetOpen}
        onSubmit={savePurchase}
        onEdit={editPurchase}
        onCancelEdit={cancelPurchaseEdit}
        onDelete={deletePurchase}
      /> : screen === "appearance" ? <More theme={theme} background={background} onThemeChange={setTheme} onBackgroundChange={setBackground} /> : screen === "notes" ? <MiniAppPlaceholder eyebrow="Tracking" title="Personal notes" note="A private place for quick thoughts, lists, and things worth remembering." icon={<NotebookPen />} /> : screen === "teams" ? <MiniAppPlaceholder eyebrow="Settings" title="Teams" note="Your shared spaces and team access will live here." icon={<Users />} /> : <>
      <PageHeader
        eyebrow="Electricity"
        trailing={<span className="pageStat"><strong><AppNumber value={activeUnits} /></strong> units</span>}
      >
        Power <em>usage.</em>
      </PageHeader>

      <section className="limitStrip" aria-label="Consumption limits">
        <span>0</span>
        <div>
          <i style={{ "--fill": Math.min(1, activeUnits / 220) }} />
          <b style={{ left: "86%" }}>190</b>
          <b style={{ left: "91%" }}>200</b>
        </div>
        <span>220</span>
      </section>

      <section className="meterList" aria-label="Meters">
        {meters.map((meter) => (
          <button
            className={meter.name === activeMeter ? `ledgerCard meterCard active ${meter.band}` : `ledgerCard meterCard ${meter.band}`}
            key={meter.name}
            type="button"
            onClick={() => setActiveMeter(meter.name)}
          >
            <span>{meter.name}</span>
            <strong>{meter.latest ? meter.units : "--"}</strong>
            <small>{meter.name === activeMeter
              ? meter.latest ? "Selected" : "Selected · no reading yet"
              : meter.latest ? `${meter.latest.current_reading} now` : "No reading yet"}</small>
          </button>
        ))}
      </section>

      <section className="history" aria-label="Recent readings">
        <div className="historyHead">
          <h2>Recent</h2>
          <button className="textButton" type="button" onClick={() => setScreen("readings")}>See all</button>
        </div>
        {readingsLoading ? <Loader variant="dots" size={18} label="Loading recent readings" className="emptyState text-primary" /> : readings.length ? readings.slice(0, 3).map((reading) => <ReadingRow key={reading.id} reading={reading} />) : <p className="emptyState">Your saved meter readings will appear here.</p>}
      </section>

      <button className="purchaseFab" type="button" aria-label="Update electricity units" onClick={() => { setMessage(""); setReadingValue(String(readingCurrent)); setReadingSheetOpen(true); }}><PlusIcon /></button>
      <BottomSheet open={readingSheetOpen} onOpenChange={setReadingSheetOpen} snapPoints={["auto", 0.82]} title="Update units" description={activeMeter} className="ledgerBottomSheet">
        <form onSubmit={saveReading}>
          <div className="unitSliderField">
            <div className="readingValueFields">
              <Input label="Current reading" type="number" min={readingPrevious} max={readingMaximum} step="1" required autoFocus value={readingValue} onChange={setReadingValue} classNames={{ field: "currentReadingInputField", input: "currentReadingInput" }} />
              <div className="previousReading"><span>Previous reading</span><output>{readingPrevious}</output></div>
            </div>
            <div className="unitSliderValue" data-band={bandFor(selectedUnits)}><span>Units used</span><strong>{selectedUnits}</strong></div>
            <RangeSlider value={selectedUnits} onValueChange={(units) => setReadingValue(String(readingPrevious + units))} min={0} max={200} step={1} tickStep={10} haptic disabled={busy} aria-label="Electricity units used" />
            <div className="unitSliderLimits" aria-hidden="true"><span>0</span><span>200</span></div>
          </div>
          <div className="purchaseFormActions"><button type="submit" disabled={busy}>{busy ? <span className="inline-flex items-center gap-2">Updating <Loader variant="dots" size={14} label="Updating electricity units" /></span> : "Update units"}</button><button className="secondaryButton" type="button" disabled={busy} onClick={() => setReadingSheetOpen(false)}>Cancel</button></div>
          {message && <p className="message" aria-live="polite">{message}</p>}
        </form>
      </BottomSheet>
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

function MiniAppPlaceholder({ eyebrow, title, note, icon }) {
  return <>
    <PageHeader eyebrow={eyebrow} note={note}>{title}<em>.</em></PageHeader>
    <section className="ledgerCard miniAppEmpty">
      <span>{icon}</span>
      <p>This mini app is ready for its next feature.</p>
    </section>
  </>;
}

function AppBackground({ background, theme }) {
  const [base, accent] = themes.find(({ id }) => id === theme)?.shaderColors ?? themes[0].shaderColors;
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

function ReadingRow({ reading }) {
  return <article className="ledgerCard">
    <span>{reading.meter_name}</span>
    <strong>{unitsFor(reading.current_reading, reading.previous_reading)} units</strong>
    <time>{formatRecentDate(reading.created_at ?? reading.reading_date)}</time>
  </article>;
}

function PageHeader({ eyebrow, children, note, leading, trailing }) {
  return <header className={`pageMast${leading ? " hasLeading" : ""}`}>
    {leading}
    <div className="pageMastCopy">
      <p className="eyebrow">{eyebrow}</p>
      <div className="pageMastTitleRow">
        <h1>{children}</h1>
        {trailing ? <div className="pageMastTrailing">{trailing}</div> : null}
      </div>
      {note ? <p className="pageMastNote">{note}</p> : null}
    </div>
  </header>;
}

function Readings({ readings, busy, message, onBack, onClear }) {
  return <>
    <PageHeader
      eyebrow="Meter ledger"
      leading={<button className="pageIconButton" type="button" onClick={onBack} aria-label="Back to meters">←</button>}
      trailing={<span className="pageCount"><AppNumber value={readings.length} /></span>}
    >
      All <em>readings.</em>
    </PageHeader>
    <section className="history allReadings" aria-label="All meter readings">
      <div className="allReadingsHead">
        <h2>History</h2>
        <button className="clearButton" type="button" disabled={busy} onClick={onClear}>{busy ? <span className="inline-flex items-center gap-2">Clearing <Loader variant="dots" size={12} label="Clearing meter readings" /></span> : "Clear entries"}</button>
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

function TimeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 3h6" /></svg>;
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
    <PageHeader eyebrow="Personal ledger">Everything, <em>accounted for.</em></PageHeader>
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
  </>;
}

function More({ theme, background, onThemeChange, onBackgroundChange }) {
  return <section className="morePanel">
    <PageHeader eyebrow="Appearance" note="Choose a background and finish for your personal ledger.">Set the <em>mood.</em></PageHeader>
    <div className="themeHeading"><div><p className="eyebrow">Background</p><h2>Choose your motion</h2></div><span><AppNumber value={backgrounds.length} /> styles</span></div>
    <div className="backgroundGrid" role="radiogroup" aria-label="App background">
      {backgrounds.map((item) => <button className={`ledgerCard backgroundCard ${item.id}${background === item.id ? " active" : ""}`} type="button" role="radio" aria-checked={background === item.id} key={item.id} onClick={() => onBackgroundChange(item.id)}>
        <span className="backgroundPreview" aria-hidden="true"><i /><i /></span>
        <span><strong>{item.name}</strong><small>{item.note}</small></span>
        <span className="themeState" aria-hidden="true"><i className="themeDot" /><i className="themeCheck">✓</i></span>
      </button>)}
    </div>
    <div className="themeHeading"><div><p className="eyebrow">Theme library</p><h2>Pick your atmosphere</h2></div><span><AppNumber value={themes.length} /> finishes</span></div>
    <div className="themeGrid" role="radiogroup" aria-label="App theme">
      {themes.map((item) => <button className={`ledgerCard themeCard${theme === item.id ? " active" : ""}`} type="button" role="radio" aria-checked={theme === item.id} aria-label={`${item.name}: ${item.note}`} key={item.id} onClick={() => onThemeChange(item.id)}>
        <span className="themePreview" style={{ "--swatch-bg": item.colors[0], "--swatch-accent": item.colors[1] }}><i /><i /><i /></span>
        <span><strong>{item.name}</strong><small>{item.note}</small></span>
        <span className="themeState" aria-hidden="true"><i className="themeDot" /><i className="themeCheck">✓</i></span>
      </button>)}
    </div>
  </section>;
}

function PlusIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
}

function Purchases({ purchases, loading, form, query, busy, message, editingPurchase, sheetOpen, setForm, setQuery, setSheetOpen, onSubmit, onEdit, onCancelEdit, onDelete }) {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(purchases.map((purchase) => purchase.category).filter(Boolean))];
  const formCategories = [...new Set([...purchaseCategories, ...categories.slice(1)])];
  const matching = purchases.filter((purchase) => {
    const matchesQuery = `${purchase.item_name} ${purchase.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (category === "All" || purchase.category === category);
  });
  const total = purchases.reduce((sum, purchase) => sum + Number(purchase.purchase_price), 0);
  const swipeablePurchases = matching.map((purchase) => ({
    id: String(purchase.id),
    content: <article className="ledgerCard purchaseCard">
      <div className="purchaseCardHead"><b>{purchase.item_name}</b><strong>{currency.format(purchase.purchase_price)}</strong></div>
      <div className="purchaseMeta"><span className="categoryTag">{purchase.category}</span><time>{new Date(`${purchase.purchase_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></div>
    </article>,
    rightActions: [
      { id: "edit", label: `Edit ${purchase.item_name}`, icon: <Pencil />, disabled: busy, onClick: () => onEdit(purchase) },
      { id: "delete", label: `Delete ${purchase.item_name}`, icon: <Trash2 />, tone: "danger", disabled: busy, onClick: () => onDelete(purchase) },
    ],
  }));
  const closeSheet = () => {
    setSheetOpen(false);
    onCancelEdit();
  };
  return <>
    <PageHeader
      eyebrow="Purchase ledger"
      note={purchases.length ? <><AppNumber value={total} format={formatCurrency} /> across your collection</> : "Your considered collection starts here"}
      trailing={<span className="pageCount"><AppNumber value={purchases.length} /></span>}
    >
      Your <em>purchases.</em>
    </PageHeader>

    <section className="history purchaseHistory" aria-label="Purchase history">
      <div className="collectionHead"><div><p className="eyebrow">Inventory</p><h2>Collection</h2></div><Input className="search" type="search" aria-label="Search purchases" placeholder="Find an item" value={query} onChange={setQuery} classNames={{ field: "searchInputField" }} /></div>
      <div className="categoryFilters" aria-label="Filter by category">{categories.map((item) => <button className={item === category ? "active" : ""} type="button" key={item} aria-pressed={item === category} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {message && !sheetOpen && <p className="message" aria-live="polite">{message}</p>}
      {loading ? <Loader variant="dots" size={18} label="Loading purchases" className="emptyState text-primary" /> : matching.length ? <SwipeableList items={swipeablePurchases} className="purchaseCards" classNames={{ item: "purchaseSwipeItem", rail: "purchaseSwipeRail", action: "purchaseSwipeAction", surface: "purchaseSwipeSurface" }} /> : <p className="emptyState">{purchases.length ? "No items match these filters." : "Add your first gadget to build your purchase history."}</p>}
    </section>

    <button className="purchaseFab" type="button" aria-label="Add purchase" onClick={() => { onCancelEdit(); setSheetOpen(true); }}><PlusIcon /></button>
    <BottomSheet open={sheetOpen} onOpenChange={(open) => open ? setSheetOpen(true) : closeSheet()} snapPoints={["auto", 0.92]} title={editingPurchase ? "Update purchase" : "Add to collection"} description="Keep the details simple — you can edit them later." className="ledgerBottomSheet">
      <form className="purchaseForm" onSubmit={onSubmit}>
        <Input label="Item name" type="text" required autoComplete="off" autoFocus placeholder="e.g. Sony WH-1000XM5" value={form.item_name} onChange={(item_name) => setForm({ ...form, item_name })} />
        <label>Category<select required value={form.category} disabled={busy} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          <option value="" disabled>Choose a category</option>
          {formCategories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <Input label="Price (PKR)" type="number" required min="0" step="1" inputMode="numeric" placeholder="0" value={form.purchase_price} onChange={(purchase_price) => setForm({ ...form, purchase_price })} />
        <DateWheelPicker value={form.purchase_date} onValueChange={(purchase_date) => setForm({ ...form, purchase_date })} disabled={busy} />
        <div className="purchaseFormActions"><button type="submit" disabled={busy}>{busy ? <span className="inline-flex items-center gap-2">Saving <Loader variant="dots" size={14} label="Saving purchase" /></span> : editingPurchase ? "Save changes" : "Save purchase"}</button><button className="secondaryButton" type="button" onClick={closeSheet} disabled={busy}>Cancel</button></div>
        {message && <p className="message" aria-live="polite">{message}</p>}
      </form>
    </BottomSheet>
  </>;
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
