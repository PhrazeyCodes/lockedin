"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, resolveSession } from "./supabase";

// Auth + profile guard for the app shell.
export function useUser({ requireProfile = true } = {}) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    async function run() {
      // Waits out a slow network on reopen instead of treating it as signed out
      const session = await resolveSession({ isAlive: () => alive });
      if (!alive) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      // A network hiccup must not look like "no profile" (that would send you to onboarding)
      let prof = null;
      for (let i = 0; alive; i++) {
        const { data, error } = await supabase
          .from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (!error) { prof = data; break; }
        await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** i, 4000)));
      }
      if (!alive) return;
      if (!prof && requireProfile) {
        router.replace("/onboarding");
        return;
      }
      setProfile(prof);
      setLoading(false);
    }
    run();
    // Only an actual sign-out sends you to the login screen — not a momentary empty session
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [router, requireProfile]);

  return { user, profile, setProfile, loading };
}
