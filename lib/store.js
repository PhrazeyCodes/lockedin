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
  // edits still waiting to be saved (or being saved) are newer than the server copy
  const unsaved = pending.get(`${uid}|${date}`) || saving.get(`${uid}|${date}`);
  if (unsaved) return unsaved.day;
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
      .gte("date", `${yyyymm}-01`).lte("date", `${yyyymm}-${String(new Date(+yyyymm.slice(0, 4), +yyyymm.slice(5, 7), 0).getDate()).padStart(2, "0")}`);
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

// ---------- Batched saving ----------
// Every edit updates the screen and the on-device copy instantly; the server save (and
// feed summary) goes out once you pause for a moment, instead of on every keystroke.
const pending = new Map(); // `${uid}|${date}` -> { timer, uid, date, day, profile }
const saving = new Map();  // same, while the server save is in flight

export function saveDaySoon(uid, date, day, profile, delay = 700) {
  writeCache(uid, date, day);
  const k = `${uid}|${date}`;
  const p = pending.get(k);
  if (p) clearTimeout(p.timer);
  const entry = { uid, date, day, profile };
  entry.timer = setTimeout(() => flushSave(k), delay);
  pending.set(k, entry);
}

async function flushSave(k) {
  const p = pending.get(k);
  if (!p) return;
  pending.delete(k);
  clearTimeout(p.timer);
  saving.set(k, p);
  try {
    await saveDay(p.uid, p.date, p.day);
  } finally {
    if (saving.get(k) === p) saving.delete(k);
  }
  await syncFeed(p.uid, p.date, p.day, p.profile);
}

export function flushAllSaves() {
  return Promise.all([...pending.keys()].map(flushSave));
}

if (typeof window !== "undefined") {
  // Leaving the app / switching away: send anything still waiting right away
  window.addEventListener("pagehide", () => flushAllSaves());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAllSaves(); });
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

// Auto-generated events (food, lift, habits…) use an empty post_key so there is
// still exactly one row per user+date+type. User-written posts get their own key
// so each one is a separate row — see FEED_KEY in lib/notifications.js.
// Last summary sent per feed entry — identical summaries aren't re-sent, so most saves
// (typing a weight, editing a note) don't touch the feed at all.
const sentFeed = new Map();

async function upsertFeed(uid, date, type, summary) {
  const k = `${uid}|${date}|${type}`, v = JSON.stringify(summary);
  if (sentFeed.get(k) === v) return;
  sentFeed.set(k, v);
  try {
    const { error } = await supabase.from("feed_events").upsert(
      { user_id: uid, date, type, summary, post_key: "" },
      { onConflict: "user_id,date,type,post_key" }
    );
    if (error) sentFeed.delete(k); // retry next save
  } catch { sentFeed.delete(k); }
}

async function removeFeed(uid, date, type) {
  const k = `${uid}|${date}|${type}`;
  if (sentFeed.get(k) === null) return;
  sentFeed.set(k, null);
  try {
    const { error } = await supabase.from("feed_events").delete()
      .eq("user_id", uid).eq("date", date).eq("type", type);
    if (error) sentFeed.delete(k);
  } catch { sentFeed.delete(k); }
}

// Called after each save — computes summaries so detail can never leak by design.
// Sections with nothing completed are REMOVED so friends never see empty entries.
export async function syncFeed(uid, date, day, profile) {
  const jobs = []; // all feed writes go out together instead of one after another
  const t = targetsFor(profile, day);
  if (day.meals?.length) {
    const tot = mealTotals(day.meals);
    jobs.push(upsertFeed(uid, date, "food", {
      meals: day.meals.length,
      kcal: Math.round(tot.kcal), kcalTarget: t.kcal,
      proteinHit: tot.p >= t.p, protein: Math.round(tot.p), proteinTarget: t.p,
    }));
  } else {
    jobs.push(removeFeed(uid, date, "food"));
  }
  if (day.lift?.type) {
    const setCount = (day.lift.exercises || []).reduce(
      (n, e) => n + (e.sets || []).filter((s) => s.done).length, 0);
    jobs.push(upsertFeed(uid, date, "lift", {
      type: day.lift.type, sets: setCount, note: day.lift.shareNote ? day.lift.note || "" : "",
    }));
  } else {
    jobs.push(removeFeed(uid, date, "lift"));
  }
  // Runs post as their own feed card. Only summary detail is shared, same as
  // everything else here.
  if (day.runs?.length) {
    jobs.push(upsertFeed(uid, date, "run", {
      items: day.runs.map((r) => ({
        distance: r.distance, unit: r.unit || "mi", duration_sec: r.duration_sec,
        caption: r.caption || null, photo_paths: r.photo_paths || [], at: r.at,
      })),
      total: day.runs.reduce((n, r) => n + (+r.distance || 0), 0),
    }));
  } else {
    jobs.push(removeFeed(uid, date, "run"));
  }
  const habitKeys = Object.keys(day.habits || {});
  const habitsDone = habitKeys.filter((k) => day.habits[k]).length;
  if (habitsDone > 0) {
    jobs.push(upsertFeed(uid, date, "habits", { done: habitsDone, total: habitKeys.length }));
  } else {
    jobs.push(removeFeed(uid, date, "habits"));
  }
  const tasksDone = (day.tasks || []).filter((x) => x.done).length;
  if (tasksDone > 0) {
    jobs.push(upsertFeed(uid, date, "tasks", { done: tasksDone, total: day.tasks.length }));
  } else {
    jobs.push(removeFeed(uid, date, "tasks"));
  }
  await Promise.all(jobs);
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