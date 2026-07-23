"use client";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { loadDay, saveDay, syncFeed, blankDay } from "@/lib/store";
import { todayStr, fmtDate, weekDates } from "@/lib/dates";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase";

const SESSIONS = {
  Push: "#dc2626", Pull: "#2563eb", Legs: "#7c3aed", "Shoulders & Arms": "#f59e0b", Rest: "#64748b",
};

const TPL_KEY = "lockedin_v1:lifttemplates";
const DEFAULT_TEMPLATES = {
  Push: [
    { name: "DB Incline Press", target: "4×6–8 @ 90 lb", sets: 4, w: "90" },
    { name: "Machine Shoulder Press", target: "3×8–10", sets: 3, w: "" },
    { name: "Cable Fly", target: "3×10–12", sets: 3, w: "" },
    { name: "Triceps Pushdown", target: "3×10–12", sets: 3, w: "" },
    { name: "Overhead Extension", target: "3×10–12", sets: 3, w: "" },
  ],
  Pull: [
    { name: "Chest-Supported T-Bar Row", target: "4×6–8 @ 2 plates", sets: 4, w: "2 pl" },
    { name: "Lat Pulldown", target: "3×8–10", sets: 3, w: "" },
    { name: "Seated Cable Row", target: "3×8–10", sets: 3, w: "" },
    { name: "Rear Delt Fly", target: "3×12–15", sets: 3, w: "" },
    { name: "EZ-Bar Curl", target: "3×8–10", sets: 3, w: "" },
    { name: "Hammer Curl", target: "3×10–12", sets: 3, w: "" },
  ],
  Legs: [
    { name: "Leg Press", target: "5 sets to failure @ 4 plates (5–7)", sets: 5, w: "4 pl" },
    { name: "Pendulum Squat", target: "3×6–8 @ 2.5 plates", sets: 3, w: "2.5 pl" },
    { name: "Romanian Deadlift", target: "3×10–12", sets: 3, w: "" },
    { name: "Leg Extension", target: "3×10–12", sets: 3, w: "" },
    { name: "Seated Calf Raise", target: "3×12–15", sets: 3, w: "" },
  ],
  "Shoulders & Arms": [
    { name: "DB Lateral Raise", target: "4×12–15", sets: 4, w: "" },
    { name: "Machine Shoulder Press", target: "3×8–10", sets: 3, w: "" },
    { name: "Cable Curl", target: "3×10–12", sets: 3, w: "" },
    { name: "Triceps Pushdown", target: "3×10–12", sets: 3, w: "" },
    { name: "Preacher Curl", target: "3×10–12", sets: 3, w: "" },
    { name: "Overhead Extension", target: "3×10–12", sets: 3, w: "" },
  ],
};

function getLiftTemplates() {
  try {
    const raw = localStorage.getItem(TPL_KEY);
    return raw ? { ...DEFAULT_TEMPLATES, ...JSON.parse(raw) } : DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}

function buildSession(type) {
  const tpl = getLiftTemplates()[type] || [];
  return {
    type,
    exercises: tpl.map((e) => ({
      name: e.name, target: e.target,
      sets: Array.from({ length: e.sets }, () => ({ w: e.w || "", r: "", done: false })),
    })),
    note: "", shareNote: false,
  };
}

export default function Lift() {
  const { user, profile, loading } = useUser();
  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState(blankDay());
  const [week, setWeek] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadDay(user.id, date).then(setDay);
  }, [user, date]);

  useEffect(() => {
    if (!user) return;
    const dates = weekDates(todayStr());
    supabase.from("days").select("date, lift").eq("user_id", user.id).in("date", dates)
      .then(({ data }) => {
        const w = {};
        for (const r of data || []) if (r.lift?.type) w[r.date] = r.lift.type;
        setWeek(w);
      });
  }, [user, day.lift]);

  const update = useCallback((mutate) => {
    setDay((prev) => {
      const next = mutate(structuredClone(prev));
      saveDay(user.id, date, next).then(() => syncFeed(user.id, date, next, profile));
      return next;
    });
  }, [user, date, profile]);

  if (loading) return null;

  const lift = day.lift;
  const dates = weekDates(todayStr());
  const totalSets = lift?.exercises?.reduce((n, e) => n + e.sets.length, 0) || 0;
  const doneSets = lift?.exercises?.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) || 0;

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lift</h1>
        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow-card">{fmtDate(date)}</span>
      </div>

      {/* week grid */}
      <div className="card mb-3 grid grid-cols-7 gap-1">
        {dates.map((d) => {
          const t = week[d];
          const sel = d === date;
          return (
            <button key={d} onClick={() => setDate(d)}
              className={`flex flex-col items-center rounded-xl py-2 ${sel ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
              <span className="text-[10px] opacity-60">{new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}</span>
              <span className="text-sm font-bold">{+d.slice(-2)}</span>
              <i className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t ? SESSIONS[t] : "transparent" }} />
            </button>
          );
        })}
      </div>

      {!lift?.type && (
        <div className="card text-center">
          <p className="mb-3 text-gray-500">Nothing logged {fmtDate(date).toLowerCase()}.</p>
          <button className="btn-primary w-full" onClick={() => setPickerOpen(true)}>Log a session</button>
        </div>
      )}

      {lift?.type === "Rest" && (
        <div className="card text-center">
          <div className="text-4xl">😴</div>
          <p className="mt-2 font-bold">Rest day logged</p>
          <p className="text-sm text-gray-500">Home is now showing rest-day macros.</p>
          <button className="btn-ghost mt-3 w-full" onClick={() => setPickerOpen(true)}>Change</button>
        </div>
      )}

      {lift?.type && lift.type !== "Rest" && (
        <>
          <div className="card mb-3">
            <div className="flex items-center justify-between">
              <span className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: SESSIONS[lift.type] }}>
                {lift.type}
              </span>
              <button className="text-sm text-gray-400" onClick={() => setPickerOpen(true)}>change</button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-lock-light transition-all" style={{ width: `${totalSets ? (100 * doneSets) / totalSets : 0}%` }} />
            </div>
            <p className="mt-1 text-right text-[11px] text-gray-500">{doneSets}/{totalSets} sets</p>
          </div>

          {lift.exercises.map((ex, ei) => (
            <div key={ei} className="card mb-3">
              <div className="mb-1 flex items-center justify-between">
                <input className="flex-1 bg-transparent font-bold outline-none" value={ex.name}
                  onChange={(e) => update((d) => { d.lift.exercises[ei].name = e.target.value; return d; })} />
                <button className="text-gray-300" onClick={() => update((d) => { d.lift.exercises.splice(ei, 1); return d; })}>✕</button>
              </div>
              {ex.target && <p className="mb-2 text-[11px] text-gray-400">{ex.target}</p>}
              <div className="space-y-1.5">
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-5 text-center text-[11px] text-gray-400">{si + 1}</span>
                    <input className="input flex-1 py-2 text-center" placeholder="weight" value={s.w}
                      onChange={(e) => update((d) => { d.lift.exercises[ei].sets[si].w = e.target.value; return d; })} />
                    <input className="input flex-1 py-2 text-center" placeholder="reps" inputMode="numeric" value={s.r}
                      onChange={(e) => update((d) => { d.lift.exercises[ei].sets[si].r = e.target.value; return d; })} />
                    <button
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 ${s.done ? "animate-pop border-lock-light bg-lock-light text-white" : "border-gray-200"}`}
                      onClick={() => update((d) => { d.lift.exercises[ei].sets[si].done = !s.done; return d; })}>
                      ✓
                    </button>
                  </div>
                ))}
              </div>
              <button className="mt-2 text-sm font-medium text-lock-light"
                onClick={() => update((d) => { d.lift.exercises[ei].sets.push({ w: ex.sets.at(-1)?.w || "", r: "", done: false }); return d; })}>
                + Add set
              </button>
            </div>
          ))}

          <button className="btn-ghost mb-3 w-full"
            onClick={() => update((d) => { d.lift.exercises.push({ name: "New exercise", target: "", sets: [{ w: "", r: "", done: false }] }); return d; })}>
            + Add exercise
          </button>

          <div className="card mb-3">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-bold">Session notes</h3>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <input type="checkbox" checked={lift.shareNote || false}
                  onChange={(e) => update((d) => { d.lift.shareNote = e.target.checked; return d; })} />
                share with friends
              </label>
            </div>
            <textarea className="input min-h-[70px]" placeholder="How did it feel? PRs? Pump rating?"
              value={lift.note || ""}
              onChange={(e) => update((d) => { d.lift.note = e.target.value; return d; })} />
          </div>

          <button className="btn-ghost mb-3 w-full text-sm"
            onClick={() => {
              const tpls = getLiftTemplates();
              tpls[lift.type] = lift.exercises.map((e) => ({
                name: e.name, target: e.target || "", sets: e.sets.length, w: e.sets[0]?.w || "",
              }));
              localStorage.setItem(TPL_KEY, JSON.stringify(tpls));
            }}>
            Save as my {lift.type} template
          </button>
        </>
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="What did you train?">
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(SESSIONS).map((t) => (
            <button key={t}
              className="rounded-2xl p-4 text-left font-bold text-white active:scale-95"
              style={{ backgroundColor: SESSIONS[t] }}
              onClick={() => {
                update((d) => { d.lift = t === "Rest" ? { type: "Rest" } : buildSession(t); return d; });
                setPickerOpen(false);
              }}>
              {t}
            </button>
          ))}
        </div>
        {lift?.type && (
          <button className="btn-ghost mt-3 w-full text-red-500"
            onClick={() => { update((d) => { d.lift = null; return d; }); setPickerOpen(false); }}>
            Clear session
          </button>
        )}
      </Sheet>
    </div>
  );
}
