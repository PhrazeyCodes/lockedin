"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import { markJournalDone } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import Sheet from "@/components/Sheet";

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

export default function Journal() {
  const { user, loading } = useUser();
  const [entry, setEntry] = useState(null); // today's row
  const [history, setHistory] = useState([]);
  const [flow, setFlow] = useState(null); // 'am' | 'pm'
  const [streak, setStreak] = useState(0);
  const date = todayStr();

  async function refresh() {
    const { data } = await supabase.from("journal").select("*")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(90);
    const rows = data || [];
    setHistory(rows);
    setEntry(rows.find((r) => r.date === date) || null);
    // streak: consecutive days with an entry
    const has = new Set(rows.map((r) => r.date));
    let s = 0, d = date;
    if (!has.has(d)) d = shiftDay(d, -1);
    while (has.has(d)) { s++; d = shiftDay(d, -1); }
    setStreak(s);
  }

  useEffect(() => { if (user) refresh(); }, [user]); // eslint-disable-line

  if (loading) return null;

  async function save(patch) {
    const row = { user_id: user.id, date, ...patch };
    await supabase.from("journal").upsert(row, { onConflict: "user_id,date" });
    await markJournalDone(user.id, date);
    setFlow(null);
    refresh();
  }

  const weights = history.filter((h) => h.weight).slice(0, 30).reverse();

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal</h1>
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-card">📓 {streak} day streak</span>
      </div>

      <p className="mb-3 rounded-xl bg-gray-100 px-3 py-2 text-[11px] text-gray-500">
        🔒 Always private. Friends only ever see "journaled today ✓".
      </p>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <button onClick={() => setFlow("am")}
          className={`card text-left active:scale-95 ${entry?.am ? "ring-2 ring-lock-light" : ""}`}>
          <div className="text-2xl">🌅</div>
          <div className="mt-1 font-bold">Morning</div>
          <div className="text-[11px] text-gray-500">{entry?.am ? "Done ✓ — tap to edit" : "Intentions · gratitude · focus"}</div>
        </button>
        <button onClick={() => setFlow("pm")}
          className={`card text-left active:scale-95 ${entry?.pm ? "ring-2 ring-lock-light" : ""}`}>
          <div className="text-2xl">🌙</div>
          <div className="mt-1 font-bold">Night</div>
          <div className="text-[11px] text-gray-500">{entry?.pm ? "Done ✓ — tap to edit" : "Wins · improve · thoughts"}</div>
        </button>
      </div>

      {weights.length > 1 && (
        <div className="card mb-3">
          <h3 className="mb-1 font-bold">Weight</h3>
          <WeightChart data={weights} />
        </div>
      )}

      <h3 className="mb-2 mt-5 font-bold">History</h3>
      {!history.length && <p className="py-4 text-center text-sm text-gray-400">No entries yet.</p>}
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.date} className="card flex items-center gap-3 py-3">
            <span className="text-xl">{h.mood || "·"}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {new Date(h.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="text-[11px] text-gray-500">
                {h.am && "🌅 "}{h.pm && "🌙 "}{h.weight && `⚖️ ${h.weight} lb`}
              </div>
            </div>
            {h.am?.focus && <span className="max-w-[40%] truncate text-[11px] text-gray-400">"{h.am.focus}"</span>}
          </div>
        ))}
      </div>

      <Flow flow={flow} entry={entry} onClose={() => setFlow(null)} onSave={save} />
    </div>
  );
}

function shiftDay(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Flow({ flow, entry, onClose, onSave }) {
  const [data, setData] = useState({});
  const [mood, setMood] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (!flow) return;
    setData(entry?.[flow] || {});
    setMood(entry?.mood || "");
    setWeight(entry?.weight || "");
  }, [flow, entry]);

  if (!flow) return null;
  const am = flow === "am";
  const fields = am
    ? [["intentions", "Today's intentions (1–3)"], ["gratitude", "Grateful for (1–3)"], ["focus", "One-line focus for the day"]]
    : [["wins", "Wins today"], ["improve", "What to improve"], ["thoughts", "Free thoughts"]];

  return (
    <Sheet open onClose={onClose} title={am ? "🌅 Morning" : "🌙 Night"}>
      <div className="space-y-3">
        {fields.map(([k, label]) => (
          <div key={k}>
            <label className="mb-1 block text-sm font-medium text-gray-600">{label}</label>
            <textarea className="input min-h-[60px]" value={data[k] || ""}
              onChange={(e) => setData({ ...data, [k]: e.target.value })} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button key={m} onClick={() => setMood(m)}
                className={`rounded-full p-1.5 text-2xl ${mood === m ? "bg-lock-faint ring-2 ring-lock-light" : "opacity-50"}`}>
                {m}
              </button>
            ))}
          </div>
          {am && (
            <input className="input w-28" type="number" inputMode="decimal" placeholder="Weight"
              value={weight} onChange={(e) => setWeight(e.target.value)} />
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Skip</button>
          <button className="btn-primary flex-1"
            onClick={() => onSave({ [flow]: data, mood: mood || null, weight: weight ? +weight : null })}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function WeightChart({ data }) {
  const w = 320, h = 80, pad = 6;
  const vals = data.map((d) => +d.weight);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => [
    pad + (i * (w - 2 * pad)) / (vals.length - 1),
    h - pad - ((v - min) / span) * (h - 2 * pad),
  ]);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <polyline fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round"
          points={pts.map((p) => p.join(",")).join(" ")} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#14532d" />)}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{vals[0]} lb</span><span>{vals.at(-1)} lb</span>
      </div>
    </div>
  );
}
