"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { loadDay, saveDay, syncFeed, mealTotals, targetsFor, isRestDay, foodStreak, pushRecent, blankDay } from "@/lib/store";
import { todayStr, addDays, fmtDate, weekDates } from "@/lib/dates";
import Rings from "@/components/Rings";
import Logger from "@/components/Logger";
import FoodEditor from "@/components/FoodEditor";
import Sheet from "@/components/Sheet";
import HabitsCard, { getHabitList } from "@/components/HabitsCard";
import HistoryCalendar from "@/components/HistoryCalendar";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { user, profile, loading } = useUser();
  const [date, setDate] = useState(todayStr());
  const [day, setDay] = useState(blankDay());
  const [streak, setStreak] = useState(0);
  const [weekMarks, setWeekMarks] = useState({});
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadDay(user.id, date).then(setDay);
  }, [user, date]);

  useEffect(() => {
    if (!user) return;
    foodStreak(user.id).then(setStreak);
    // weekly habit dots
    const week = weekDates(todayStr());
    supabase.from("days").select("date, habits").eq("user_id", user.id)
      .in("date", week).then(({ data }) => {
        const marks = {};
        for (const h of getHabitList()) {
          marks[h] = week.map((d) => !!(data || []).find((r) => r.date === d)?.habits?.[h]);
        }
        setWeekMarks(marks);
      });
  }, [user, day.habits]);

  const update = useCallback((mutate) => {
    setDay((prev) => {
      const next = mutate(structuredClone(prev));
      saveDay(user.id, date, next).then(() => syncFeed(user.id, date, next, profile));
      return next;
    });
  }, [user, date, profile]);

  if (loading) return <Splash />;

  const totals = mealTotals(day.meals);
  const targets = targetsFor(profile, day);
  const rest = isRestDay(day);

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setCalOpen(true)}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-card active:scale-95">
          {fmtDate(date)} ▾
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-card">🔥 {streak}</span>
          <Link href="/settings" className="rounded-full bg-white p-2 shadow-card">⚙️</Link>
        </div>
      </div>

      {date !== todayStr() && (
        <button className="mb-3 w-full rounded-xl bg-lock-faint py-2 text-sm font-medium text-lock"
          onClick={() => setDate(todayStr())}>
          Viewing {fmtDate(date)} — back to today
        </button>
      )}

      <div className="mb-1 flex items-center justify-between px-1">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rest ? "bg-blue-50 text-blue-600" : "bg-lock-faint text-lock"}`}>
          {rest ? "Rest day" : "Training day"} · {targets.kcal} kcal
        </span>
        <div className="flex gap-1">
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setDate(addDays(date, -1))}>←</button>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setDate(addDays(date, 1))}>→</button>
        </div>
      </div>

      <Rings totals={totals} targets={targets} />

      {/* Water */}
      <div className="card mt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">Water</h3>
          <span className="text-sm text-gray-500">{day.water}/8 cups</span>
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 8 }, (_, i) => (
            <button key={i} className="text-2xl transition active:scale-90"
              onClick={() => update((d) => { d.water = i + 1 === d.water ? i : i + 1; return d; })}>
              {i < day.water ? "💧" : "◯"}
            </button>
          ))}
        </div>
      </div>

      {/* Meals */}
      <div className="card mt-3">
        <h3 className="mb-2 font-bold">Meals</h3>
        {!day.meals.length && <p className="py-4 text-center text-sm text-gray-400">Nothing logged yet — hit +</p>}
        <div className="space-y-2">
          {day.meals.map((m) => (
            <button key={m.id} onClick={() => setEditingMeal(m)}
              className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-2.5 text-left active:bg-gray-100">
              {m.photo
                ? <img src={m.photo} alt="" className="h-11 w-11 rounded-lg object-cover" />
                : <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-lock-faint text-xl">🍽</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.name}</div>
                <div className="text-[11px] text-gray-500">P{Math.round(m.p)} · C{Math.round(m.c)} · F{Math.round(m.f)}</div>
              </div>
              <span className="text-sm font-bold">{m.kcal}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Habits */}
      <div className="mt-3">
        <HabitsCard habits={day.habits} weekMarks={weekMarks}
          onToggle={(h) => update((d) => { d.habits[h] = !d.habits[h]; return d; })} />
      </div>

      {/* + button */}
      <button onClick={() => setLoggerOpen(true)}
        className="fixed bottom-24 left-1/2 z-30 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-lock text-3xl font-light text-white shadow-lg active:scale-90">
        +
      </button>

      <Logger open={loggerOpen} onClose={() => setLoggerOpen(false)}
        onLog={(food) => { pushRecent(food); update((d) => { d.meals.push(food); return d; }); }} />

      <Sheet open={!!editingMeal} onClose={() => setEditingMeal(null)} title="Edit meal">
        {editingMeal && (
          <>
            <FoodEditor initial={editingMeal} saveLabel="Save"
              onSave={(f) => { update((d) => { d.meals = d.meals.map((m) => (m.id === f.id ? f : m)); return d; }); setEditingMeal(null); }}
              onCancel={() => setEditingMeal(null)} />
            <button className="btn mt-2 w-full text-red-500"
              onClick={() => { update((d) => { d.meals = d.meals.filter((m) => m.id !== editingMeal.id); return d; }); setEditingMeal(null); }}>
              Delete
            </button>
          </>
        )}
      </Sheet>

      <HistoryCalendar open={calOpen} onClose={() => setCalOpen(false)} uid={user?.id} onPick={setDate} />
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-4xl">🔒</div>
    </div>
  );
}
