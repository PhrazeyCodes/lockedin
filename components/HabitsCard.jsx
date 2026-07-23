"use client";
import { useState } from "react";

const NS = "lockedin_v1:habitlist";
const DEFAULTS = ["Supplement stack", "8h sleep", "1 gallon water", "215g protein"];

export function getHabitList() {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(NS);
    return raw ? JSON.parse(raw) : DEFAULTS;
  } catch { return DEFAULTS; }
}

export default function HabitsCard({ habits, weekMarks, onToggle }) {
  const [list, setList] = useState(getHabitList());
  const [adding, setAdding] = useState(false);
  const [newHabit, setNewHabit] = useState("");

  function addHabit() {
    const name = newHabit.trim();
    if (!name || list.includes(name)) return;
    const next = [...list, name];
    setList(next);
    localStorage.setItem(NS, JSON.stringify(next));
    setNewHabit(""); setAdding(false);
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold">Habits</h3>
        <button className="text-sm font-medium text-lock-light" onClick={() => setAdding(!adding)}>+ Add</button>
      </div>
      {adding && (
        <div className="mb-2 flex gap-2">
          <input className="input flex-1 py-2" placeholder="New habit" value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)} />
          <button className="btn-primary py-2" onClick={addHabit}>Add</button>
        </div>
      )}
      <div className="space-y-1.5">
        {list.map((h) => {
          const done = !!habits[h];
          return (
            <div key={h} className="flex items-center gap-2">
              <button onClick={() => onToggle(h)}
                className={`flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${done ? "bg-lock-faint" : "bg-gray-50"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] ${done ? "animate-pop border-lock-light bg-lock-light text-white" : "border-gray-300"}`}>
                  {done && "✓"}
                </span>
                <span className={`text-sm font-medium ${done ? "text-lock" : ""}`}>{h}</span>
              </button>
              {/* compressed weekly grid */}
              <div className="flex gap-0.5">
                {(weekMarks[h] || Array(7).fill(false)).map((v, i) => (
                  <i key={i} className={`h-1.5 w-1.5 rounded-full ${v ? "bg-lock-light" : "bg-gray-200"}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
