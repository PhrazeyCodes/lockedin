// Proof shots: after you log something, LockedIn asks for a quick photo and drops it
// onto today's card in the feed (the existing per-day "photos" feed event).
import { supabase } from "./supabase";
import { todayStr } from "./dates";

const NS = "lockedin_v1:proof";

// Every kind of log that can ask for a proof shot. Meals are opt-in (default off) —
// nobody wants a prompt for every snack.
export const PROOF_KINDS = {
  lift:    { label: "Workouts",            chip: "Lift",    icon: "barbell",  default: true },
  run:     { label: "Runs",                chip: "Run",     icon: "run",      default: true },
  food:    { label: "Meals",               chip: "Meal",    icon: "bowl",     default: false },
  journal: { label: "Journal",             chip: "Journal", icon: "notebook", default: true },
  nn:      { label: "Non-negotiables done", chip: "Locked in", icon: "lock",  default: true },
};

const ls = () => (typeof window !== "undefined" ? window.localStorage : null);
const read = (k, fb) => { try { const v = ls()?.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { ls()?.setItem(k, JSON.stringify(v)); } catch {} };

// ---------- Settings (synced to the account so phone app + Safari agree) ----------

export function getProofPrefs() {
  const saved = read(`${NS}:prefs`, {});
  return Object.fromEntries(Object.entries(PROOF_KINDS).map(([k, v]) => [k, saved[k] ?? v.default]));
}

export async function setProofPrefs(prefs) {
  write(`${NS}:prefs`, prefs);
  const { error } = await supabase.auth.updateUser({ data: { proof_prefs: prefs } });
  return !error;
}

export function cacheProofPrefsFromAccount(md) {
  if (md?.proof_prefs) write(`${NS}:prefs`, md.proof_prefs);
}

// ---------- When to ask ----------
// At most once per kind per day. Skip three in a row and that kind rests for 3 days.

export function shouldAsk(kind, date = todayStr()) {
  if (date !== todayStr()) return false;            // only for what you're doing right now
  if (!getProofPrefs()[kind]) return false;
  if (read(`${NS}:asked:${date}:${kind}`, false)) return false;
  const snooze = read(`${NS}:snooze:${kind}`, null);
  if (snooze && snooze >= todayStr()) return false;
  return true;
}

export function markAsked(kind, date = todayStr()) { write(`${NS}:asked:${date}:${kind}`, true); }

export function recordSkip(kind) {
  const n = read(`${NS}:skips:${kind}`, 0) + 1;
  if (n >= 3) {
    const d = new Date(); d.setDate(d.getDate() + 3);
    write(`${NS}:snooze:${kind}`, d.toISOString().slice(0, 10));
    write(`${NS}:skips:${kind}`, 0);
  } else write(`${NS}:skips:${kind}`, n);
}

export function recordPosted(kind) { write(`${NS}:skips:${kind}`, 0); }

export async function turnOff(kind) {
  return setProofPrefs({ ...getProofPrefs(), [kind]: false });
}

// Fire the prompt from anywhere: askForProof("lift", { title: "Push day done" })
export function askForProof(kind, opts = {}) {
  if (typeof window === "undefined" || !shouldAsk(kind)) return;
  markAsked(kind);
  // small delay so it doesn't collide with the "Logged" toast
  setTimeout(() => window.dispatchEvent(new CustomEvent("li-proof", { detail: { kind, ...opts } })), 700);
}

// ---------- Image: shrink so uploads are fast on cell data ----------
// (Time + type are shown under the photo in the feed, so nothing is burned into the image —
// the feed crops tall photos and a burned-in stamp would get cut off.)

export async function shrinkPhoto(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const max = 1600, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob || file;
  } catch {
    return file; // older browsers: post the original
  }
}

// ---------- Post: append to today's "photos" feed event ----------

export async function postProofShot(uid, { kind, blob, caption }) {
  const date = todayStr();
  const path = `${uid}/proof/${date}-${kind}-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from("checkins")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (upErr) throw upErr;

  const { data: existing } = await supabase.from("feed_events").select("summary")
    .eq("user_id", uid).eq("date", date).eq("type", "photos").maybeSingle();
  const items = [...(existing?.summary?.items || []),
    { path, caption: caption?.trim() || "", at: new Date().toISOString(), kind, live: true }];
  const { error } = await supabase.from("feed_events").upsert(
    { user_id: uid, date, type: "photos", summary: { items }, post_key: "" },
    { onConflict: "user_id,date,type,post_key" });
  if (error) throw error;
  recordPosted(kind);
}
