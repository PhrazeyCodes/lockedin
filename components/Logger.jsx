"use client";
import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import FoodEditor from "./FoodEditor";
import { scanImage, describeFood, searchUSDA, lookupBarcode, fileToScanPayload } from "@/lib/nutrition";
import { getRecents } from "@/lib/store";

// MacroFactor-style unified logger. Every path lands in the same FoodEditor.
export default function Logger({ open, onClose, onLog }) {
  const [view, setView] = useState("menu"); // menu | describe | barcode | search | quick | recents | editor
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) { setView("menu"); setEditing(null); setError(""); setBusy(false); }
  }, [open]);

  function toEditor(food) { setEditing(food); setView("editor"); }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const { base64, mime } = await fileToScanPayload(file);
      const result = await scanImage(base64, mime);
      toEditor({ ...result, qty: 1, unit: "serving", photo: `data:image/jpeg;base64,${base64}` });
    } catch (err) { setError(err.message); }
    setBusy(false);
    e.target.value = "";
  }

  const MENU = [
    { icon: "📸", title: "Scan food", sub: "Photo → AI macros", action: () => fileRef.current?.click() },
    { icon: "💬", title: "Describe it", sub: "Type the meal, AI breaks it down", action: () => setView("describe") },
    { icon: "▦", title: "Barcode", sub: "Scan a package", action: () => setView("barcode") },
    { icon: "🔍", title: "Search", sub: "USDA food database", action: () => setView("search") },
    { icon: "⚡️", title: "Quick add", sub: "Enter macros directly", action: () => setView("quick") },
    { icon: "🕐", title: "Recents", sub: "One-tap relog", action: () => setView("recents") },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={view === "menu" ? "Log food" : undefined}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {busy && <p className="mb-2 animate-pulse text-sm text-gray-500">Analyzing…</p>}

      {view === "menu" && (
        <div className="grid grid-cols-2 gap-2">
          {MENU.map((m) => (
            <button key={m.title} onClick={m.action}
              className="rounded-2xl bg-gray-50 p-4 text-left transition active:scale-95">
              <div className="text-2xl">{m.icon}</div>
              <div className="mt-1 font-semibold">{m.title}</div>
              <div className="text-[11px] text-gray-500">{m.sub}</div>
            </button>
          ))}
        </div>
      )}

      {view === "describe" && <Describe onResult={toEditor} setBusy={setBusy} setError={setError} busy={busy} />}
      {view === "barcode" && <Barcode onResult={toEditor} setError={setError} />}
      {view === "search" && <Search onResult={toEditor} setError={setError} />}
      {view === "quick" && (
        <FoodEditor initial={{ name: "", kcal: 0, p: 0, c: 0, f: 0, qty: 1, unit: "serving" }}
          onSave={(f) => { onLog(f); onClose(); }} onCancel={() => setView("menu")} />
      )}
      {view === "recents" && <Recents onPick={(f) => toEditor({ ...f, ts: null, id: null })} />}
      {view === "editor" && editing && (
        <FoodEditor initial={editing}
          onSave={(f) => { onLog(f); onClose(); }} onCancel={() => setView("menu")} />
      )}
    </Sheet>
  );
}

function Describe({ onResult, setBusy, setError, busy }) {
  const [text, setText] = useState("");
  async function go() {
    setBusy(true); setError("");
    try {
      const r = await describeFood(text);
      onResult({ ...r, qty: 1, unit: "serving" });
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <textarea className="input min-h-[90px]" placeholder="e.g. chipotle bowl with double chicken, white rice, black beans, cheese"
        value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-primary w-full" disabled={!text.trim() || busy} onClick={go}>
        {busy ? "Analyzing…" : "Analyze"}
      </button>
    </div>
  );
}

function Barcode({ onResult, setError }) {
  const [status, setStatus] = useState("starting");
  useEffect(() => {
    let scanner;
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        scanner = new Html5Qrcode("bc-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (code) => {
            if (stopped) return;
            stopped = true;
            try { await scanner.stop(); } catch {}
            try {
              const p = await lookupBarcode(code);
              onResult({ name: p.name, brand: p.brand, per100: p.per100, qty: p.servingG || 100, unit: "g" });
            } catch (e) { setError(e.message); }
          },
          () => {}
        );
        setStatus("scanning");
      } catch (e) {
        setStatus("error");
        setError("Camera unavailable: " + e.message);
      }
    })();
    return () => { stopped = true; try { scanner?.stop(); } catch {} };
  }, [onResult, setError]);
  return (
    <div>
      <div id="bc-reader" className="overflow-hidden rounded-2xl bg-black" style={{ minHeight: 220 }} />
      <p className="mt-2 text-center text-sm text-gray-500">
        {status === "scanning" ? "Point at a barcode" : "Starting camera…"}
      </p>
    </div>
  );
}

function Search({ onResult, setError }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setError("");
    try { setResults(await searchUSDA(q)); } catch (e) { setError(e.message); }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <input className="input min-w-0 flex-1" placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!q.trim() || busy}>{busy ? "…" : "Go"}</button>
      </form>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {results.map((r, i) => (
          <button key={i} className="w-full rounded-xl bg-gray-50 p-3 text-left active:bg-gray-100"
            onClick={() => onResult({ name: r.name, brand: r.brand, per100: r.per100, qty: 100, unit: "g" })}>
            <div className="text-sm font-semibold">{r.name}</div>
            <div className="text-[11px] text-gray-500">
              {r.brand && `${r.brand} · `}{Math.round(r.per100.kcal)} kcal / 100g
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Recents({ onPick }) {
  const recents = getRecents();
  if (!recents.length) return <p className="py-6 text-center text-sm text-gray-400">No recent foods yet.</p>;
  return (
    <div className="max-h-80 space-y-1 overflow-y-auto">
      {recents.map((r, i) => (
        <button key={i} className="w-full rounded-xl bg-gray-50 p-3 text-left active:bg-gray-100" onClick={() => onPick(r)}>
          <div className="text-sm font-semibold">{r.name}</div>
          <div className="text-[11px] text-gray-500">{r.kcal} kcal · P{r.p} C{r.c} F{r.f}</div>
        </button>
      ))}
    </div>
  );
}