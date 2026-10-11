"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { supabase } from "@/lib/supabase";
import { weekDates, todayStr } from "@/lib/dates";
import { getNNList, saveNNList, activeNN, patchJournal } from "@/lib/journal";

// Daily non-negotiables. Checks live in journal.nn (owner-only), the list itself per device.
// Kept short on purpose — the point is doing all of them every single day.
export default function NonNegotiables({ uid, date = todayStr(), onChange }) {
  const [all, setAll] = useState(getNNList());
  const [checks, setChecks] = useState({});
  const [week, setWeek] = useState({}); // date -> nn
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const list = activeNN(all);
  const dates = weekDates(date);

  useEffect(() => {
    if (!uid) return;
    supabase.from("journal").select("date, nn").eq("user_id", uid).in("date", dates)
      .then(({ data }) => {
        const w = Object.fromEntries((data || []).map((r) => [r.date, r.nn || {}]));
        setWeek(w);
        setChecks(w[date] || {});
      });
  }, [uid, date]); // eslint-disable-line

  async function toggle(id) {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    setWeek({ ...week, [date]: next });
    await patchJournal(uid, date, { nn: next });
    onChange?.(next);
  }

  function persist(next) { setAll(next); saveNNList(next); }

  function add() {
    const label = draft.trim();
    if (!label) return;
    persist([...all, { id: crypto.randomUUID().slice(0, 8), label }]);
    setDraft("");
  }

  const done = list.filter((i) => checks[i.id]).length;
  const allDone = list.length > 0 && done === list.length;

  return (
    <div className={`card ${allDone ? "ring-2 ring-lock-light" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold">
          <Icon name="target" className="h-[18px] w-[18px] text-lock" /> Non-negotiables
        </h3>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${allDone ? "text-lock-light" : "text-gray-500"}`}>{done}/{list.length}</span>
          <button className="text-sm font-medium text-lock-light" onClick={() => setEditing(!editing)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <>
          <p className="mb-2 text-[11px] text-gray-500">Keep it to 5–6. Realistic beats impressive — these should happen every day.</p>
          <div className="mb-2 flex gap-2">
            <input className="input min-w-0 flex-1 py-2" placeholder="New non-negotiable" value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="btn-primary shrink-0 py-2" onClick={add}>Add</button>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        {(editing ? all : list).map((i) => {
          const on = !!checks[i.id];
          return (
            <div key={i.id} className="flex items-center gap-2">
              <button disabled={editing} onClick={() => toggle(i.id)}
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${on ? "bg-lock-faint" : "bg-gray-50"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "animate-pop border-lock-light bg-lock-light text-white" : "border-gray-300"}`}>
                  {on && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={`truncate text-sm font-medium ${on ? "text-lock" : ""}`}>{i.label}</span>
                {i.trading && editing && <span className="ml-auto text-[10px] text-gray-400">trading</span>}
              </button>
              {editing ? (
                <button aria-label="Remove" className="shrink-0 rounded-full bg-red-50 p-1.5 text-red-500 active:scale-90"
                  onClick={() => persist(all.filter((x) => x.id !== i.id))}>
                  <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              ) : (
                <div className="flex shrink-0 gap-0.5">
                  {dates.map((d) => (
                    <i key={d} className={`h-1.5 w-1.5 rounded-full ${week[d]?.[i.id] ? "bg-lock-light" : "bg-gray-200"}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {allDone && !editing && (
        <p className="mt-2 text-center text-[12px] font-semibold text-lock-light">All done — that's a locked-in day.</p>
      )}
    </div>
  );
}
