"use client";
import { useState } from "react";
import Icon from "./Icon";

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
  const [editing, setEditing] = useState(false);
  const [newHabit, setNewHabit] = useState("");

  function persist(next) {
    setList(next);
    localStorage.setItem(NS, JSON.stringify(next));
  }

  function addHabit() {
    const name = newHabit.trim();
    if (!name || list.includes(name)) return;
    persist([...list, name]);
    setNewHabit("");
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold">Habits</h3>
        <button className="text-sm font-medium text-lock-light" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing && (
        <div className="mb-2 flex gap-2">
          <input className="input min-w-0 flex-1 py-2" placeholder="New habit" value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()} />
          <button className="btn-primary shrink-0 py-2" onClick={addHabit}>Add</button>
        </div>
      )}
      {!list.length && <p className="py-3 text-center text-sm text-gray-400">No habits — tap Edit to add your own.</p>}
      <div className="space-y-1.5">
        {list.map((h) => {
          const done = !!habits[h];
          return (
            <div key={h} className="flex items-center gap-2">
              <button onClick={() => onToggle(h)}
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${done ? "bg-lock-faint" : "bg-gray-50"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${done ? "animate-pop border-lock-light bg-lock-light text-white" : "border-gray-300"}`}>
                  {done && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={`truncate text-sm font-medium ${done ? "text-lock" : ""}`}>{h}</span>
              </button>
              {editing ? (
                <button aria-label="Remove habit"
                  className="shrink-0 rounded-full bg-red-50 p-1.5 text-red-500 active:scale-90"
                  onClick={() => persist(list.filter((x) => x !== h))}>
                  <Icon name="x" className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              ) : (
                <div className="flex shrink-0 gap-0.5">
                  {(weekMarks[h] || Array(7).fill(false)).map((v, i) => (
                    <i key={i} className={`h-1.5 w-1.5 rounded-full ${v ? "bg-lock-light" : "bg-gray-200"}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}