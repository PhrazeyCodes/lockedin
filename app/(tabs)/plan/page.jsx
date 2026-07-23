"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { loadDay, saveDay, syncFeed, blankDay } from "@/lib/store";
import { todayStr, addDays, fmtDate } from "@/lib/dates";
import Sheet from "@/components/Sheet";

const CATS = {
  Gym: "#14532d", Cardio: "#dc2626", Work: "#2563eb", School: "#7c3aed",
  Meals: "#f59e0b", Sleep: "#64748b", "Deep Work": "#0f766e", Free: "#9ca3af",
};
const HOUR_PX = 52;
const TPL_KEY = "lockedin_v1:daytemplates";

function getTemplates() {
  try { return JSON.parse(localStorage.getItem(TPL_KEY) || "[]"); } catch { return []; }
}
function saveTemplates(t) { localStorage.setItem(TPL_KEY, JSON.stringify(t)); }

export default function Plan() {
  const { user, profile, loading } = useUser();
  const [seg, setSeg] = useState("schedule");
  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState(blankDay());
  const [editing, setEditing] = useState(null); // block being edited/created
  const [tplOpen, setTplOpen] = useState(false);
  const timelineRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadDay(user.id, date).then(async (d) => {
      // auto-apply repeating template on an empty day
      if (!d.blocks?.length) {
        const dow = new Date(date + "T12:00:00").getDay();
        const tpl = getTemplates().find((t) => t.repeatDays?.includes(dow));
        if (tpl) d = { ...d, blocks: tpl.blocks.map((b) => ({ ...b, id: crypto.randomUUID(), done: false })) };
      }
      // carry over yesterday's incomplete tasks (once)
      if (date === todayStr() && !d.carryDone) {
        const prev = await loadDay(user.id, addDays(date, -1));
        const carried = (prev.tasks || []).filter((t) => !t.done)
          .map((t) => ({ ...t, id: crypto.randomUUID(), carry: (t.carry || 0) + 1 }));
        if (carried.length) d = { ...d, tasks: [...carried, ...(d.tasks || [])] };
        d.carryDone = true;
      }
      setDay(d);
      saveDay(user.id, date, d);
    });
  }, [user, date]);

  useEffect(() => {
    if (seg === "schedule") {
      // scroll to 5:00
      setTimeout(() => timelineRef.current?.scrollTo({ top: 5 * HOUR_PX }), 50);
    }
  }, [seg, date]);

  const update = useCallback((mutate) => {
    setDay((prev) => {
      const next = mutate(structuredClone(prev));
      saveDay(user.id, date, next).then(() => syncFeed(user.id, date, next, profile));
      return next;
    });
  }, [user, date, profile]);

  if (loading) return null;

  const blocks = day.blocks || [];
  const doneBlocks = blocks.filter((b) => b.done).length;
  const pct = blocks.length ? Math.round((100 * doneBlocks) / blocks.length) : 0;
  const nowMin = (() => {
    if (date !== todayStr()) return null;
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();

  return (
    <div className="flex flex-col px-4 pt-4"
      style={{ height: "calc(100dvh - 5.5rem - env(safe-area-inset-bottom))" }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setDate(addDays(date, -1))}>←</button>
          <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow-card">{fmtDate(date)}</span>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setDate(addDays(date, 1))}>→</button>
        </div>
        <button className="text-sm font-medium text-lock-light" onClick={() => setTplOpen(true)}>Templates</button>
      </div>

      <div className="mb-3 grid grid-cols-2 rounded-xl bg-gray-200/70 p-1 text-sm font-semibold">
        {["schedule", "tasks"].map((s) => (
          <button key={s} onClick={() => setSeg(s)}
            className={`rounded-lg py-1.5 capitalize ${seg === s ? "bg-white shadow" : "text-gray-500"}`}>
            {s}
          </button>
        ))}
      </div>

      {seg === "schedule" && (
        <>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-500">{blocks.length ? `${doneBlocks}/${blocks.length} blocks done` : "No blocks yet — tap a time"}</span>
            <span className="font-bold text-lock">{pct}% executed</span>
          </div>
          <div ref={timelineRef}
            className="no-scrollbar overscroll-contain relative flex-1 overflow-y-auto rounded-2xl bg-white shadow-card"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
            <div className="relative" style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute w-full border-t border-gray-100" style={{ top: h * HOUR_PX, height: HOUR_PX }}
                  onClick={() => setEditing({ id: null, title: "", cat: "Gym", start: h * 60, end: h * 60 + 60, note: "" })}>
                  <span className="ml-1 text-[10px] text-gray-400">{fmtMin(h * 60)}</span>
                </div>
              ))}
              {nowMin !== null && (
                <div className="absolute z-10 w-full border-t-2 border-red-500" style={{ top: (nowMin / 60) * HOUR_PX }}>
                  <i className="absolute -left-0 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                </div>
              )}
              {blocks.map((b) => (
                <button key={b.id}
                  className="absolute left-12 right-2 overflow-hidden rounded-lg px-2 py-1 text-left text-white"
                  style={{
                    top: (b.start / 60) * HOUR_PX + 1,
                    height: Math.max(22, ((b.end - b.start) / 60) * HOUR_PX - 2),
                    backgroundColor: CATS[b.cat] || "#9ca3af",
                    opacity: b.done ? 0.55 : 1,
                  }}
                  onClick={(e) => { e.stopPropagation(); setEditing(b); }}>
                  <div className="text-xs font-bold leading-tight">{b.done && "✓ "}{b.title || b.cat}</div>
                  <div className="text-[10px] opacity-80">{fmtMin(b.start)}–{fmtMin(b.end)}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {seg === "tasks" && (
        <Tasks day={day} update={update} />
      )}

      <BlockEditor block={editing} onClose={() => setEditing(null)}
        onSave={(b) => {
          update((d) => {
            d.blocks = b.id
              ? d.blocks.map((x) => (x.id === b.id ? b : x))
              : [...(d.blocks || []), { ...b, id: crypto.randomUUID() }];
            return d;
          });
          setEditing(null);
        }}
        onDelete={(b) => { update((d) => { d.blocks = d.blocks.filter((x) => x.id !== b.id); return d; }); setEditing(null); }}
        onToggle={(b) => { update((d) => { d.blocks = d.blocks.map((x) => (x.id === b.id ? { ...x, done: !x.done } : x)); return d; }); setEditing(null); }} />

      <TemplatesSheet open={tplOpen} onClose={() => setTplOpen(false)} day={day}
        onApply={(tpl) => {
          update((d) => {
            d.blocks = tpl.blocks.map((b) => ({ ...b, id: crypto.randomUUID(), done: false }));
            return d;
          });
          setTplOpen(false);
        }} />
    </div>
  );
}

function fmtMin(m) {
  const h = Math.floor(m / 60), min = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return min === 0 ? `${h12} ${ampm}` : `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

function BlockEditor({ block, onClose, onSave, onDelete, onToggle }) {
  const [b, setB] = useState(block);
  useEffect(() => setB(block), [block]);
  if (!b) return null;
  const times = Array.from({ length: 48 }, (_, i) => i * 30);
  return (
    <Sheet open={!!block} onClose={onClose} title={b.id ? "Edit block" : "New block"}>
      <div className="space-y-3">
        <input className="input" placeholder="Title" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CATS).map(([c, color]) => (
            <button key={c} onClick={() => setB({ ...b, cat: c })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${b.cat === c ? "ring-2 ring-offset-1 ring-gray-900" : "opacity-60"}`}
              style={{ backgroundColor: color }}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={b.start} onChange={(e) => setB({ ...b, start: +e.target.value })}>
            {times.map((t) => <option key={t} value={t}>{fmtMin(t)}</option>)}
          </select>
          <select className="input" value={b.end} onChange={(e) => setB({ ...b, end: +e.target.value })}>
            {times.filter((t) => t > b.start).map((t) => <option key={t} value={t}>{fmtMin(t)}</option>)}
          </select>
        </div>
        <input className="input" placeholder="Note (optional)" value={b.note || ""} onChange={(e) => setB({ ...b, note: e.target.value })} />
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={() => onSave(b)}>Save</button>
        </div>
        {b.id && (
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => onToggle(b)}>{b.done ? "Mark not done" : "Mark done ✓"}</button>
            <button className="btn-ghost flex-1 text-red-500" onClick={() => onDelete(b)}>Delete</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function TemplatesSheet({ open, onClose, day, onApply }) {
  const [tpls, setTpls] = useState([]);
  const [name, setName] = useState("");
  useEffect(() => { if (open) setTpls(getTemplates()); }, [open]);
  const DOW = ["S", "M", "T", "W", "T", "F", "S"];

  function saveCurrent() {
    if (!name.trim() || !day.blocks?.length) return;
    const next = [...tpls, { name: name.trim(), blocks: day.blocks, repeatDays: [] }];
    setTpls(next); saveTemplates(next); setName("");
  }
  function toggleRepeat(i, dow) {
    const next = tpls.map((t, j) => j !== i ? t : {
      ...t, repeatDays: t.repeatDays?.includes(dow) ? t.repeatDays.filter((d) => d !== dow) : [...(t.repeatDays || []), dow],
    });
    setTpls(next); saveTemplates(next);
  }
  return (
    <Sheet open={open} onClose={onClose} title="Day templates">
      <div className="mb-3 flex gap-2">
        <input className="input flex-1" placeholder='Save today as… e.g. "Training Day"' value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={saveCurrent} disabled={!day.blocks?.length}>Save</button>
      </div>
      {!tpls.length && <p className="py-4 text-center text-sm text-gray-400">No templates yet.</p>}
      <div className="space-y-2">
        {tpls.map((t, i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t.name}</span>
              <div className="flex gap-2">
                <button className="text-sm font-medium text-lock-light" onClick={() => onApply(t)}>Apply</button>
                <button className="text-sm text-red-400" onClick={() => { const n = tpls.filter((_, j) => j !== i); setTpls(n); saveTemplates(n); }}>✕</button>
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              {DOW.map((d, dow) => (
                <button key={dow} onClick={() => toggleRepeat(i, dow)}
                  className={`h-7 w-7 rounded-full text-xs font-bold ${t.repeatDays?.includes(dow) ? "bg-lock text-white" : "bg-gray-200 text-gray-500"}`}>
                  {d}
                </button>
              ))}
              <span className="ml-1 self-center text-[10px] text-gray-400">auto-repeat</span>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Tasks({ day, update }) {
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState("med");
  const tasks = day.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  const PRIO = { high: "bg-red-100 text-red-600", med: "bg-amber-100 text-amber-600", low: "bg-gray-100 text-gray-500" };

  function add() {
    if (!title.trim()) return;
    update((d) => { d.tasks = [...(d.tasks || []), { id: crypto.randomUUID(), title: title.trim(), priority: prio, done: false }]; return d; });
    setTitle("");
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="mb-2 text-sm text-gray-500">{tasks.length ? `Cleared ${done}/${tasks.length}` : "No tasks yet"}</div>
      <div className="mb-3 flex gap-2">
        <input className="input flex-1" placeholder="Add a task…" value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <select className="input w-24" value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="high">High</option><option value="med">Med</option><option value="low">Low</option>
        </select>
        <button className="btn-primary" onClick={add}>+</button>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-card">
            <button onClick={() => update((d) => { d.tasks = d.tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x); return d; })}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs ${t.done ? "animate-pop border-lock-light bg-lock-light text-white" : "border-gray-300"}`}>
              {t.done && "✓"}
            </button>
            <span className={`flex-1 text-sm font-medium ${t.done ? "text-gray-400 line-through" : ""}`}>
              {t.title}
              {t.carry > 0 && <span className="ml-1.5 text-[10px] text-amber-500">↻{t.carry}</span>}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIO[t.priority]}`}>{t.priority}</span>
            <button className="text-gray-300" onClick={() => update((d) => { d.tasks = d.tasks.filter((x) => x.id !== t.id); return d; })}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}