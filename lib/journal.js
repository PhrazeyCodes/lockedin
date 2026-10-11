// Journal extras: non-negotiables, sleep, day review + the "why was today good?" analysis.
// Everything here lives in the owner-only `journal` table — friends never see any of it.
import { supabase } from "./supabase";
import { addDays, todayStr } from "./dates";

const NS = "lockedin_v1";
const ls = () => (typeof window !== "undefined" ? window.localStorage : null);

// ---------- Settings (per device, like the habit list) ----------

// No preset list — each person writes their own (keep it short and realistic).
export function getNNList() {
  try {
    const raw = ls()?.getItem(`${NS}:nnlist`);
    const list = raw ? JSON.parse(raw) : null;
    // Drop the old preset items if a device saved them before presets were removed
    const old = ["routine", "morning", "todo", "diet", "cardio", "trade"];
    if (Array.isArray(list)) return list.filter((i) => !i.trading && !old.includes(i.id));
  } catch {}
  return [];
}

export function saveNNList(list) {
  try { ls()?.setItem(`${NS}:nnlist`, JSON.stringify(list)); } catch {}
}

export function activeNN(list = getNNList()) {
  return list;
}

// ---------- Saving (no "journaled today" feed post for these quick logs) ----------

export async function patchJournal(uid, date, patch) {
  const { error } = await supabase.from("journal")
    .upsert({ user_id: uid, date, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id,date" });
  return !error;
}

export async function loadJournalDay(uid, date) {
  const { data } = await supabase.from("journal").select("*")
    .eq("user_id", uid).eq("date", date).maybeSingle();
  return data;
}

// ---------- Helpers ----------

export function nnDone(row, list) {
  const nn = row?.nn || {};
  return list.filter((i) => nn[i.id]).length;
}

// Consecutive days with every non-negotiable done (today not done yet doesn't break it)
export function perfectStreak(rows, list) {
  if (!list.length) return 0;
  const perfect = new Set(rows.filter((r) => nnDone(r, list) === list.length).map((r) => r.date));
  let d = todayStr(), s = 0;
  if (!perfect.has(d)) d = addDays(d, -1);
  while (perfect.has(d)) { s++; d = addDays(d, -1); }
  return s;
}

export function taskStats(dayRow) {
  const tasks = dayRow?.tasks || [];
  return { total: tasks.length, done: tasks.filter((t) => t.done).length };
}

// ---------- Insights: what separates good days from off days ----------

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Build one flat record per rated day so every factor can be compared
export function buildRecords(journalRows, dayRows, list) {
  const days = Object.fromEntries((dayRows || []).map((d) => [d.date, d]));
  return journalRows
    .filter((r) => r.pm?.rating)
    .map((r) => {
      const t = taskStats(days[r.date]);
      return {
        date: r.date,
        rating: +r.pm.rating,
        energy: r.pm.energy ? +r.pm.energy : null,
        sleep: r.sleep?.hours ? +r.sleep.hours : null,
        sleepScore: r.sleep?.score ? +r.sleep.score : null,
        readiness: r.sleep?.readiness ? +r.sleep.readiness : null,
        nnPct: list.length ? nnDone(r, list) / list.length : null,
        tasksPct: t.total ? t.done / t.total : null,
        deepWork: r.pm.deep_work ? +r.pm.deep_work : null,
        nn: r.nn || {},
      };
    });
}

const FACTORS = [
  { key: "sleep", label: "Sleep", fmt: (v) => `${v.toFixed(1)}h` },
  { key: "sleepScore", label: "Sleep score", fmt: (v) => Math.round(v) },
  { key: "readiness", label: "Readiness", fmt: (v) => Math.round(v) },
  { key: "nnPct", label: "Non-negotiables", fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "tasksPct", label: "To-do cleared", fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "deepWork", label: "Deep work", fmt: (v) => `${v.toFixed(1)}h` },
  { key: "energy", label: "Energy", fmt: (v) => `${v.toFixed(1)}/5` },
];

// Good = rated 7+, off = rated 5 or less. Needs a few of each to say anything useful.
export function analyze(records, list) {
  const good = records.filter((r) => r.rating >= 7);
  const off = records.filter((r) => r.rating <= 5);
  const ready = good.length >= 2 && off.length >= 2;

  const factors = FACTORS.map((f) => {
    const g = avg(good.map((r) => r[f.key]).filter((v) => v != null));
    const o = avg(off.map((r) => r[f.key]).filter((v) => v != null));
    // Relative gap so hours and percentages can be ranked together
    const gap = g != null && o != null ? (g - o) / (Math.max(Math.abs(g), Math.abs(o)) || 1) : null;
    return { ...f, good: g, off: o, gap };
  }).filter((f) => f.good != null || f.off != null);

  // Which non-negotiable matters most: average rating when done vs skipped
  const items = list.map((i) => {
    const done = records.filter((r) => r.nn[i.id]).map((r) => r.rating);
    const skipped = records.filter((r) => !r.nn[i.id]).map((r) => r.rating);
    const d = avg(done), s = avg(skipped);
    return { ...i, done: d, skipped: s, lift: d != null && s != null ? d - s : null, n: done.length };
  }).filter((i) => i.lift != null).sort((a, b) => b.lift - a.lift);

  // Sleep threshold: rating on 7h+ nights vs under 7h
  const slept = records.filter((r) => r.sleep != null);
  const rested = avg(slept.filter((r) => r.sleep >= 7).map((r) => r.rating));
  const short = avg(slept.filter((r) => r.sleep < 7).map((r) => r.rating));

  const takeaways = [];
  if (rested != null && short != null) {
    takeaways.push(`You rate days ${rested.toFixed(1)}/10 after 7h+ of sleep vs ${short.toFixed(1)} after less.`);
  }
  if (items[0] && items[0].lift > 0.5) {
    takeaways.push(`"${items[0].label}" moves your day the most: +${items[0].lift.toFixed(1)} points when you do it.`);
  }
  const top = factors.filter((f) => f.gap != null && f.key !== "energy").sort((a, b) => b.gap - a.gap)[0];
  if (ready && top && top.gap > 0.1) {
    takeaways.push(`Biggest gap: ${top.label.toLowerCase()} — ${top.fmt(top.good)} on good days vs ${top.fmt(top.off)} on off days.`);
  }

  return {
    ready, good: good.length, off: off.length, total: records.length,
    avgRating: avg(records.map((r) => r.rating)),
    factors, items, takeaways,
  };
}
