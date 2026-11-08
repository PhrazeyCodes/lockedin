"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, resolveSession, reportConnection } from "./supabase";

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
    const { data, error } = await supabase
      .from("profiles").select("*").eq("id", session.user.id).maybeSingle();
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
    setTimeout(() => { inflight = null; }, r.stale ? 0 : 30_000); // try again soon if we used a saved copy
    return r;
  }, (e) => { inflight = null; throw e; });
  return inflight;
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
    revalidate().then((res) => {
      if (!alive) return;
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
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [router, requireProfile]);

  return { user, profile, setProfile, loading };
}
