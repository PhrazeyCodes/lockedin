// Data layer: Supabase `days` docs with a localStorage cache under lockedin_v1,
// sync-on-reconnect. Feed events contain ONLY summary fields — never detail.
import { supabase } from "./supabase";
import { todayStr } from "./dates";

const NS = "lockedin_v1";
const ls = typeof window !== "undefined" ? window.localStorage : null;

export function blankDay() {
  return { meals: [], water: 0, habits: {}, lift: null, runs: [], tasks: [], blocks: [] };
}

function cacheKey(uid, date) {
  return `${NS}:days:${uid}:${date}`;
}

export function readCache(uid, date) {
  if (!ls) return null;
  try {
    const raw = ls.getItem(cacheKey(uid, date));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(uid, date, day) {
  try {
    ls?.setItem(cacheKey(uid, date), JSON.stringify(day));
  } catch {}
}

export async function loadDay(uid, date) {
  const cached = readCache(uid, date);
  try {
    const { data } = await supabase
      .from("days").select("*").eq("user_id", uid).eq("date", date).maybeSingle();
    if (data) {
      const day = { ...blankDay(), meals: data.meals || [], water: data.water || 0,
        habits: data.habits || {}, lift: data.lift, runs: data.runs || [],
        tasks: data.tasks || [], blocks: data.blocks || [] };
      writeCache(uid, date, day);
      return day;
    }
  } catch {}
  return cached || blankDay();
}

// Months of history for the calendar dots
export async function loadMonth(uid, yyyymm) {
  try {
    const { data } = await supabase
      .from("days").select("date, meals, lift, habits")
      .eq("user_id", uid)
      .gte("date", `${yyyymm}-01`).lte("date", `${yyyymm}-31`);
    return data || [];
  } catch {
    return [];
  }
}

const QUEUE_KEY = `${NS}:queue`;

function queuePush(item) {
  try {
    const q = JSON.parse(ls?.getItem(QUEUE_KEY) || "[]");
    q.push(item);
    ls?.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
}

export async function flushQueue() {
  if (!ls) return;
  let q;
  try { q = JSON.parse(ls.getItem(QUEUE_KEY) || "[]"); } catch { return; }
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try {
      const { error } = await supabase.from("days").upsert(item, { onConflict: "user_id,date" });
      if (error) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  ls.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => flushQueue());
}

export async function saveDay(uid, date, day) {
  writeCache(uid, date, day);
  const row = {
    user_id: uid, date,
    meals: day.meals, water: day.water, habits: day.habits,
    lift: day.lift, runs: day.runs || [], tasks: day.tasks, blocks: day.blocks,
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("days").upsert(row, { onConflict: "user_id,date" });
    if (error) queuePush(row);
  } catch {
    queuePush(row);
  }
}

// ---------- Feed summaries (privacy boundary lives here) ----------

export function mealTotals(meals) {
  return (meals || []).reduce(
    (t, m) => ({ kcal: t.kcal + (+m.kcal || 0), p: t.p + (+m.p || 0), c: t.c + (+m.c || 0), f: t.f + (+m.f || 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

export function isRestDay(day) {
  return day?.lift?.type === "Rest";
}

export function targetsFor(profile, day) {
  const t = profile?.targets || {};
  return isRestDay(day)
    ? t.rest || { kcal: 1800, p: 215, c: 100, f: 55 }
    : t.train || { kcal: 2200, p: 215, c: 210, f: 55 };
}

async function upsertFeed(uid, date, type, summary) {
  try {
    await supabase.from("feed_events").upsert(
      { user_id: uid, date, type, summary },
      { onConflict: "user_id,date,type" }
    );
  } catch {}
}

async function removeFeed(uid, date, type) {
  try {
    await supabase.from("feed_events").delete()
      .eq("user_id", uid).eq("date", date).eq("type", type);
  } catch {}
}

// Called after each save — computes summaries so detail can never leak by design.
// Sections with nothing completed are REMOVED so friends never see empty entries.
export async function syncFeed(uid, date, day, profile) {
  const t = targetsFor(profile, day);
  if (day.meals?.length) {
    const tot = mealTotals(day.meals);
    await upsertFeed(uid, date, "food", {
      meals: day.meals.length,
      kcal: Math.round(tot.kcal), kcalTarget: t.kcal,
      proteinHit: tot.p >= t.p, protein: Math.round(tot.p), proteinTarget: t.p,
    });
  } else {
    await removeFeed(uid, date, "food");
  }
  if (day.lift?.type) {
    const setCount = (day.lift.exercises || []).reduce(
      (n, e) => n + (e.sets || []).filter((s) => s.done).length, 0);
    await upsertFeed(uid, date, "lift", {
      type: day.lift.type, sets: setCount, note: day.lift.shareNote ? day.lift.note || "" : "",
    });
  } else {
    await removeFeed(uid, date, "lift");
  }
  // Runs post as their own feed card. Only summary detail is shared, same as
  // everything else here.
  if (day.runs?.length) {
    await upsertFeed(uid, date, "run", {
      items: day.runs.map((r) => ({
        distance: r.distance, unit: r.unit || "mi", duration_sec: r.duration_sec,
        caption: r.caption || null, photo_paths: r.photo_paths || [], at: r.at,
      })),
      total: day.runs.reduce((n, r) => n + (+r.distance || 0), 0),
    });
  } else {
    await removeFeed(uid, date, "run");
  }
  const habitKeys = Object.keys(day.habits || {});
  const habitsDone = habitKeys.filter((k) => day.habits[k]).length;
  if (habitsDone > 0) {
    await upsertFeed(uid, date, "habits", { done: habitsDone, total: habitKeys.length });
  } else {
    await removeFeed(uid, date, "habits");
  }
  const tasksDone = (day.tasks || []).filter((x) => x.done).length;
  if (tasksDone > 0) {
    await upsertFeed(uid, date, "tasks", { done: tasksDone, total: day.tasks.length });
  } else {
    await removeFeed(uid, date, "tasks");
  }
}

export async function markJournalDone(uid, date) {
  await upsertFeed(uid, date, "journal_done", { done: true });
}

// ---------- Streaks ----------

export async function foodStreak(uid) {
  try {
    const { data } = await supabase
      .from("days").select("date, meals").eq("user_id", uid)
      .order("date", { ascending: false }).limit(120);
    if (!data) return 0;
    const logged = new Set(data.filter((d) => (d.meals || []).length > 0).map((d) => d.date));
    let streak = 0;
    let d = todayStr();
    if (!logged.has(d)) d = addDaysLocal(d, -1); // today not logged yet doesn't break it
    while (logged.has(d)) { streak++; d = addDaysLocal(d, -1); }
    return streak;
  } catch {
    return 0;
  }
}

function addDaysLocal(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ---------- Recents (for one-tap relogging) ----------

export function getRecents() {
  try { return JSON.parse(ls?.getItem(`${NS}:recents`) || "[]"); } catch { return []; }
}

export function pushRecent(food) {
  try {
    const r = getRecents().filter((x) => x.name !== food.name);
    r.unshift({ name: food.name, brand: food.brand, kcal: food.kcal, p: food.p, c: food.c, f: food.f, qty: food.qty, unit: food.unit });
    ls?.setItem(`${NS}:recents`, JSON.stringify(r.slice(0, 20)));
  } catch {}
}