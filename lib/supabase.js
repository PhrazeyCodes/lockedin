import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// Every request gets a time limit. On iPhone, a request made right as the app wakes up can
// stall forever; without a limit the app sat on the loading screen waiting for it.
// Photo/voice uploads get longer since they can legitimately take a while on cell data.
function fetchWithTimeout(input, init = {}) {
  const href = typeof input === "string" ? input : input?.url || "";
  // sign-in renewal normally takes <1s, so a stalled one is cut off fast
  const ms = href.includes("/storage/v1/") ? 120_000 : href.includes("/auth/v1/") ? 6_000 : 15_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  if (init.signal) {
    if (init.signal.aborted) ctrl.abort();
    else init.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: fetchWithTimeout },
});

// Resolve with the promise, or reject after ms — so nothing can wait forever
export function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

// Is a saved sign-in sitting in this device's storage?
function hasStoredSession() {
  try {
    const k = supabase.auth.storageKey || `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    return !!localStorage.getItem(k);
  } catch { return false; }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolve the current session without logging people out over a bad connection.
// When the app is reopened, the access token has usually expired and has to be refreshed.
// If the phone's network isn't ready yet, that refresh fails and getSession() returns null
// even though the saved sign-in is still perfectly valid. So:
//   - session found              → return it
//   - nothing saved on device    → return null (truly signed out → login screen)
//   - saved sign-in but refresh failed → keep retrying instead of bouncing to login.
// If Supabase actually rejects the refresh token, it clears it from storage, and we stop.
export async function resolveSession({ isAlive = () => true, maxWaitMs = 10000 } = {}) {
  const start = Date.now();
  for (let attempt = 0; isAlive(); attempt++) {
    let data, error;
    try {
      ({ data, error } = await withTimeout(supabase.auth.getSession(), 6000));
    } catch {
      // the sign-in check itself stalled — open with the saved sign-in instead of waiting
      if (hasStoredSession()) return storedSession();
      error = new Error("timeout");
    }
    if (data?.session) return data.session;
    if (!hasStoredSession() && (attempt > 0 || !error)) return null;
    // Still can't refresh after ~10s: open the app with the saved sign-in anyway (your
    // data is cached on the phone). Supabase keeps refreshing quietly in the background.
    if (Date.now() - start > maxWaitMs) return storedSession();
    await wait(Math.min(400 * 2 ** attempt, 3000));
  }
  return null;
}

function storedSession() {
  try {
    const k = supabase.auth.storageKey || `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    const v = JSON.parse(localStorage.getItem(k) || "null");
    const sess = v?.currentSession || v;
    return sess?.user ? sess : null;
  } catch { return null; }
}

// Tell the app shell the server can't be reached (shows a "Retry" banner instead of a spinner)
export function reportConnection(ok) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("li-conn", { detail: ok }));
}
