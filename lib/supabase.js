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
export async function resolveSession({ isAlive = () => true } = {}) {
  for (let attempt = 0; isAlive(); attempt++) {
    const { data, error } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    if (!hasStoredSession() && (attempt > 0 || !error)) return null;
    await wait(Math.min(400 * 2 ** attempt, 4000));
  }
  return null;
}
