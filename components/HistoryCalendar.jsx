"use client";
import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { loadMonth } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { todayStr } from "@/lib/dates";

// Month view with dot markers. source="days": amber = food, red = lift, green = habits.
// source="journal": purple = journal entry that day.
export default function HistoryCalendar({ open, onClose, uid, onPick, source = "days" }) {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [marks, setMarks] = useState({});

  useEffect(() => {
    if (!open || !uid) return;
    if (source === "journal") {
      supabase.from("journal").select("date, am, pm")
        .eq("user_id", uid).gte("date", `${month}-01`).lte("date", `${month}-31`)
        .then(({ data }) => {
          const m = {};
          for (const r of data || []) m[r.date] = { journal: !!(r.am || r.pm) };
          setMarks(m);
        });
      return;
    }
    loadMonth(uid, month).then((rows) => {
      const m = {};
      for (const r of rows) {
        m[r.date] = {
          food: (r.meals || []).length > 0,
          lift: !!r.lift?.type,
          habits: Object.values(r.habits || {}).some(Boolean),
        };
      }
      setMarks(m);
    });
  }, [open, uid, month, source]);

  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const days = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Mon-first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  function shift(n) {
    const d = new Date(y, mo - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <button className="btn-ghost px-3 py-1" onClick={() => shift(-1)}>←</button>
        <h2 className="font-bold">{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <button className="btn-ghost px-3 py-1" onClick={() => shift(1)}>→</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-400">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${month}-${String(d).padStart(2, "0")}`;
          const mk = marks[dateStr];
          const isToday = dateStr === todayStr();
          return (
            <button key={i} onClick={() => { onPick(dateStr); onClose(); }}
              className={`flex flex-col items-center rounded-xl py-1.5 active:bg-gray-100 ${isToday ? "bg-lock-faint font-bold text-lock" : ""}`}>
              <span className="text-sm">{d}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {mk?.food && <i className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                {mk?.lift && <i className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                {mk?.habits && <i className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                {mk?.journal && <i className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-[11px] text-gray-500">
        {source === "journal" ? (
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-purple-500" />journaled</span>
        ) : (
          <>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />food</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />lift</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />habits</span>
          </>
        )}
      </div>
    </Sheet>
  );
}