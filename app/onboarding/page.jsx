"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

const GOALS = [
  { id: "cut", label: "Cut", icon: "flame" },
  { id: "bulk", label: "Bulk", icon: "trendingUp" },
  { id: "maintain", label: "Maintain", icon: "scale" },
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Onboarding() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [goalType, setGoalType] = useState("cut");
  const [goalWeight, setGoalWeight] = useState("");
  const [startWeight, setStartWeight] = useState("");
  const [checkinDay, setCheckinDay] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
    });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const verb = goalType === "cut" ? "Cut to" : goalType === "bulk" ? "Bulk to" : "Maintain";
      const goalText = goalType === "maintain" ? "Maintain" : `${verb} ${goalWeight}`;
      const { error } = await supabase.from("profiles").insert({
        id: session.user.id,
        username: username.toLowerCase().trim(),
        display_name: displayName.trim() || username,
        goal_type: goalType,
        goal_text: goalText,
        goal_weight: goalWeight ? +goalWeight : null,
        start_weight: startWeight ? +startWeight : null,
        checkin_day: checkinDay,
      });
      if (error) throw error;
      router.push("/home");
    } catch (err) {
      setError(err.message.includes("duplicate") ? "Username taken — try another." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-bold">Set up your profile</h1>
      <p className="mb-6 mt-1 text-gray-500">Friends find you by username. Your goal shows on your profile.</p>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" placeholder="username (a–z, 0–9, _)" value={username}
          onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          required minLength={3} maxLength={20} />
        <input className="input" placeholder="Display name" value={displayName}
          onChange={(e) => setDisplayName(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          {GOALS.map((g) => (
            <button type="button" key={g.id}
              className={`btn ${goalType === g.id ? "bg-lock text-white" : "bg-gray-100"}`}
              onClick={() => setGoalType(g.id)}>
              <span className="flex items-center justify-center gap-1.5"><Icon name={g.icon} className="h-[18px] w-[18px]" /> {g.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" inputMode="decimal" placeholder="Current weight (lb)"
            value={startWeight} onChange={(e) => setStartWeight(e.target.value)} />
          {goalType !== "maintain" && (
            <input className="input" type="number" inputMode="decimal" placeholder="Target weight (lb)"
              value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} required />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">Weekly check-in day</label>
          <select className="input" value={checkinDay} onChange={(e) => setCheckinDay(+e.target.value)}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Lock in"}</button>
      </form>
    </div>
  );
}