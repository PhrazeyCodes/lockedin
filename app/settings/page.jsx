"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import { getUserApiKey, setUserApiKey } from "@/lib/nutrition";
import { showToast } from "@/components/Toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Defined OUTSIDE the page component so inputs keep focus while typing —
// an inline component would be re-created (and remounted) on every keystroke.
function TargetGrid({ mode, label, targets, setTargets }) {
  const t = targets[mode];
  const fields = [["kcal", "kcal"], ["p", "Protein g"], ["c", "Carbs g"], ["f", "Fat g"]];
  return (
    <div className="card">
      <h3 className="mb-2 font-bold">{label}</h3>
      <div className="grid grid-cols-4 gap-2">
        {fields.map(([k, lab]) => (
          <div key={k}>
            <label className="text-[10px] text-gray-500">{lab}</label>
            <input className="input px-2 py-2 text-center" type="text" inputMode="numeric"
              value={t[k]} placeholder="0"
              onChange={(e) => setTargets({ ...targets, [mode]: { ...t, [k]: e.target.value.replace(/[^0-9]/g, "") } })} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, profile, setProfile, loading } = useUser();
  const [targets, setTargets] = useState(null);
  const [goalText, setGoalText] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [checkinDay, setCheckinDay] = useState(0);
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!profile) return;
    setTargets(structuredClone(profile.targets));
    setGoalText(profile.goal_text || "");
    setGoalWeight(profile.goal_weight || "");
    setCheckinDay(profile.checkin_day ?? 0);
    setApiKey(getUserApiKey());
  }, [profile]);

  if (loading || !targets) return null;

  async function save() {
    // Sanitize: inputs hold raw strings while typing so editing never glitches
    const clean = {};
    for (const mode of ["train", "rest"]) {
      clean[mode] = Object.fromEntries(
        Object.entries(targets[mode]).map(([k, v]) => [k, Math.max(0, Math.round(+v || 0))])
      );
    }
    const patch = {
      targets: clean,
      goal_text: goalText,
      goal_weight: goalWeight ? +goalWeight : null,
      checkin_day: checkinDay,
    };
    await supabase.from("profiles").update(patch).eq("id", user.id);
    setProfile({ ...profile, ...patch });
    setTargets(structuredClone(clean));
    setSaved(true);
    showToast("Settings saved ✓");
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-3 px-4 py-6 pb-16">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button className="text-sm font-medium text-gray-500" onClick={() => router.back()}>Done</button>
      </div>
      <div className="card">
        <div className="text-sm text-gray-500">@{profile.username}</div>
        <div className="font-bold">{profile.display_name}</div>
      </div>
      <TargetGrid mode="train" label="Training day targets" targets={targets} setTargets={setTargets} />
      <TargetGrid mode="rest" label="Rest day targets" targets={targets} setTargets={setTargets} />
      <div className="card space-y-2">
        <h3 className="font-bold">Goal</h3>
        <input className="input" value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder='e.g. "Cut to 180"' />
        <input className="input" type="number" inputMode="decimal" value={goalWeight}
          onChange={(e) => setGoalWeight(e.target.value)} placeholder="Target weight (lb)" />
        <label className="block text-sm font-medium text-gray-600">Weekly check-in day</label>
        <select className="input" value={checkinDay} onChange={(e) => setCheckinDay(+e.target.value)}>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
      <div className="card space-y-2">
        <h3 className="font-bold">AI food scan</h3>
        <p className="text-[12px] text-gray-500">
          Paste your own Anthropic API key to power photo & describe-it logging. It's stored only on this
          device (never on our servers) and sent directly to the scan endpoint. Get one at console.anthropic.com.
        </p>
        <input className="input" type="password" placeholder="sk-ant-…" value={apiKey}
          autoComplete="off" onChange={(e) => setApiKey(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-primary flex-1"
            onClick={() => { setUserApiKey(apiKey); setKeySaved(true); setTimeout(() => setKeySaved(false), 1500); }}>
            {keySaved ? "Saved ✓" : "Save key"}
          </button>
          {apiKey && (
            <button className="btn-ghost text-red-500"
              onClick={() => { setUserApiKey(""); setApiKey(""); }}>
              Clear
            </button>
          )}
        </div>
      </div>
      <button className="btn-primary w-full" onClick={save}>{saved ? "Saved ✓" : "Save"}</button>
      <button className="btn-ghost w-full text-red-500"
        onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}>
        Sign out
      </button>
    </div>
  );
}