import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

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
    const { data, error } = await supabase.auth.getSession();
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
