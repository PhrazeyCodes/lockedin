"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

export default function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Already signed in? Skip this screen. (The home-screen icon can open straight onto /login.)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/home");
      else setChecking(false);
    });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.push("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/home");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Icon name="lock" className="h-10 w-10 animate-pulse text-lock" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 pb-20">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-lock text-white"><Icon name="lock" className="h-8 w-8" /></div>
        <h1 className="text-3xl font-bold tracking-tight">LockedIn</h1>
        <p className="mt-1 text-gray-500">Show up. Your friends are watching.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="input" type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button className="mt-4 text-sm font-medium text-lock-light"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
        {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}