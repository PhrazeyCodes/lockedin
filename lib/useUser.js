"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

// Auth + profile guard for the app shell.
export function useUser({ requireProfile = true } = {}) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    async function run() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (!alive) return;
      if (!prof && requireProfile) {
        router.replace("/onboarding");
        return;
      }
      setProfile(prof);
      setLoading(false);
    }
    run();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [router, requireProfile]);

  return { user, profile, setProfile, loading };
}
