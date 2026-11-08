"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, resolveSession, reportConnection, withTimeout } from "./supabase";

// Auth + profile guard for the app shell.
//
// Speed: the signed-in user and profile are kept in memory (and on the device) after the
// first load, so switching tabs renders instantly instead of re-checking the login and
// re-downloading the profile every time. A fresh copy is still fetched in the background.

const PROFILE_KEY = "lockedin_v1:me";
let mem = null;          // { user, profile } shared by every page + the nav bar
let inflight = null;     // one network check at a time, shared by everyone asking
// The very first render must match the pre-built HTML (no cache), or React throws it away
// and re-renders. After that first paint, every tab switch can render from the cache directly.
let hydrated = false;
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function readStored() {
  try { const v = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); return v?.user ? v : null; } catch { return null; }
}
function store(v) {
  mem = v;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(v)); } catch {}
}

async function fetchMe() {
  const session = await resolveSession();
  if (!session) return { signedOut: true };
  // A network hiccup must not look like "no profile" (that would send you to onboarding).
  // Retry a few times; if the server still can't be reached, use the profile saved on this
  // phone so the app opens, and show a "can't connect" banner instead of spinning forever.
  for (let i = 0; ; i++) {
    let data = null, error = null;
    try {
      ({ data, error } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(), 8000));
    } catch (e) { error = e; } // stalled request counts as a failed try
    if (!error) { reportConnection(true); return { user: session.user, profile: data }; }
    if (i === 3) {
      reportConnection(false);
      const saved = readStored();
      if (saved?.user?.id === session.user.id && saved.profile) return { user: session.user, profile: saved.profile, stale: true };
    }
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** i, 5000)));
  }
}

function revalidate() {
  if (!inflight) inflight = fetchMe().then((r) => {
    // reuse a good answer for 30s; never reuse "signed out" or a saved-copy answer
    if (r.signedOut || r.stale) inflight = null;
    else setTimeout(() => { inflight = null; }, 30_000);
    return r;
  }, (e) => { inflight = null; throw e; });
  return inflight;
}

// Sign-in / sign-out anywhere (including the login screen) resets the remembered answer,
// so you're never bounced back to the login screen right after signing in.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") inflight = null;
    if (event === "SIGNED_OUT") { mem = null; try { localStorage.removeItem(PROFILE_KEY); } catch {} }
  });
}

export function useUser({ requireProfile = true } = {}) {
  const initial = hydrated ? (mem || readStored()) : null;
  const [user, setUser] = useState(initial?.user || null);
  const [profile, setProfileState] = useState(initial?.profile || null);
  const [loading, setLoading] = useState(!(initial?.user && (initial.profile || !requireProfile)));
  const router = useRouter();

  function setProfile(p) {
    setProfileState(p);
    if (mem?.user) store({ ...mem, profile: p });
  }

  // First app open: fill in from the cache right after hydration, before the screen paints
  useIsoLayoutEffect(() => {
    hydrated = true;
    if (!initial) { // this copy started empty (first app open) — fill it from the cache
      const c = mem || readStored();
      if (c?.user && (c.profile || !requireProfile)) {
        setUser(c.user); setProfileState(c.profile); setLoading(false);
      }
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    let alive = true;
    // Watchdog: if we're still on the loading screen after 12s, say so (with a Retry button)
    const watchdog = setTimeout(() => { if (alive) reportConnection(false); }, 12_000);
    revalidate().catch(() => ({ failed: true })).then((res) => {
      clearTimeout(watchdog);
      if (!alive) return;
      if (res.failed) { reportConnection(false); return; }
      if (res.signedOut) {
        mem = null;
        try { localStorage.removeItem(PROFILE_KEY); } catch {}
        router.replace("/login");
        return;
      }
      if (!res.profile && requireProfile) { router.replace("/onboarding"); return; }
      store({ user: res.user, profile: res.profile });
      // only re-render if something actually changed
      setUser((u) => (u?.id === res.user.id ? u : res.user));
      setProfileState((p) => (JSON.stringify(p) === JSON.stringify(res.profile) ? p : res.profile));
      setLoading(false);
    });
    // Only an actual sign-out sends you to the login screen — not a momentary empty session
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        mem = null; inflight = null;
        try { localStorage.removeItem(PROFILE_KEY); } catch {}
        router.replace("/login");
      }
      if (event === "SIGNED_IN") inflight = null;
    });
    return () => { alive = false; clearTimeout(watchdog); sub.subscription.unsubscribe(); };
  }, [router, requireProfile]);

  return { user, profile, setProfile, loading };
}
