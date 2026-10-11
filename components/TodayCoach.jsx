"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { slotOf } from "@/lib/meals";
import { todayStr } from "@/lib/dates";

// Time-aware "what's next" card at the top of Home.
// Shows ONE clear next action for right now, plus a quiet timeline of the whole day,
// so the user always knows what to do next without being nagged about everything at once.

const DISMISS = (date) => `lockedin_v1:coachskip:${date}`;

function getSkipped(date) {
  try { return JSON.parse(localStorage.getItem(DISMISS(date)) || "[]"); } catch { return []; }
}

function greeting(h) {
  if (h >= 4 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

// Builds the day's steps. `due` = should be done by now, `later` = not yet relevant.
export function buildSteps({ h, journal, day, nnList }) {
  const has = (slot) => (day.meals || []).some((m) => slotOf(m) === slot);
  const tasks = day.tasks || [];
  const tDone = tasks.filter((t) => t.done).length;
  const nextTask = [...tasks].filter((t) => !t.done)
    .sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, med: 1, low: 2 }[b.priority] ?? 1))[0];
  const nn = journal?.nn || {};
  const nnLeft = nnList.filter((i) => !nn[i.id]);
  const late = h < 4; // after midnight still counts as "tonight"
  const hr = late ? h + 24 : h;

  const steps = [
    {
      id: "am", label: "Morning journal", icon: "sunrise", done: !!journal?.am,
      from: 4, to: 12,
      title: "Start with your morning journal",
      sub: "Set your intentions and today's focus — 3 minutes.",
      cta: "Log morning journal", href: "/journal?open=am",
    },
    {
      id: "sleep", label: "Sleep", icon: "bed", done: !!journal?.sleep,
      from: 4, to: 12,
      title: "Log last night's sleep",
      sub: "How long and how well did you sleep? 10 seconds.",
      cta: "Log sleep", href: "/journal?open=sleep",
    },
    {
      id: "plan", label: "To-do list", icon: "clipboard", done: tasks.length > 0,
      from: 4, to: 12,
      title: "Plan your day",
      sub: "Write today's to-do list before the day gets away from you.",
      cta: "Add to-dos", href: "/plan?tab=tasks",
    },
    {
      id: "breakfast", label: "Breakfast", icon: "sunrise", done: has("breakfast"),
      from: 8, to: 11, meal: "breakfast",
      title: "Log your breakfast", sub: "Track it now while you remember what you ate.",
      cta: "Log breakfast",
    },
    {
      id: "tasks", label: tasks.length ? `To-do ${tDone}/${tasks.length}` : "To-do",
      icon: "clipboard", done: tasks.length > 0 && tDone === tasks.length,
      hidden: !tasks.length,
      from: 9, to: 28,
      title: tDone === 0 ? "Get started on your to-do list" : `${tasks.length - tDone} task${tasks.length - tDone > 1 ? "s" : ""} left`,
      sub: nextTask ? `Next up: ${nextTask.title}` : "",
      cta: "Open to-do list", href: "/plan?tab=tasks",
      progress: tasks.length ? tDone / tasks.length : 0,
    },
    {
      id: "lunch", label: "Lunch", icon: "bowl", done: has("lunch"),
      from: 12.5, to: 16, meal: "lunch",
      title: "Log your lunch", sub: "Stay on diet — log it before the afternoon slips by.",
      cta: "Log lunch",
    },
    {
      id: "dinner", label: "Dinner", icon: "moon", done: has("dinner"),
      from: 18.5, to: 22, meal: "dinner",
      title: "Log your dinner", sub: "Close out your macros for the day.",
      cta: "Log dinner",
    },
    {
      id: "nn", label: `Non-negotiables ${nnList.length - nnLeft.length}/${nnList.length}`, icon: "target",
      done: nnList.length > 0 && !nnLeft.length, hidden: !nnList.length,
      from: 17, to: 28,
      title: `${nnLeft.length} non-negotiable${nnLeft.length > 1 ? "s" : ""} left`,
      sub: nnLeft.map((i) => i.label).join(" · "),
      cta: "Check them off", anchor: "nn",
      progress: nnList.length ? (nnList.length - nnLeft.length) / nnList.length : 0,
    },
    {
      id: "pm", label: "Night journal", icon: "moon", done: !!journal?.pm,
      from: 20, to: 28,
      title: "Close out your day",
      sub: "Rate today and write down what went well — this powers your Good day formula.",
      cta: "Log night journal", href: "/journal?open=pm",
    },
  ];
  // due = inside its window now; missed = window passed without it
  return steps.map((st) => ({ ...st, due: hr >= st.from && hr < st.to, missed: !st.done && hr >= st.to }));
}

// Which step to surface first. Meals have short windows so they beat the to-do list;
// late at night, closing out the day matters more than squeezing in tasks.
function priority(h) {
  const base = ["am", "sleep", "plan", "breakfast", "lunch", "dinner"];
  return h >= 21 || h < 4 ? [...base, "pm", "nn", "tasks"] : [...base, "tasks", "nn", "pm"];
}

export default function TodayCoach({ name, journal, day, nnList, onLogMeal }) {
  const date = todayStr();
  const [now, setNow] = useState(null); // client-only: time + localStorage would mismatch the server render
  const [skipped, setSkipped] = useState([]);
  const rowRef = useRef(null);
  // Keep the timeline scrolled to what's happening now, not this morning's finished steps
  useEffect(() => {
    const row = rowRef.current, chip = row?.querySelector("[data-now]");
    if (row && chip) row.scrollLeft += chip.getBoundingClientRect().left - row.getBoundingClientRect().left - 16;
  }, [now]);
  useEffect(() => {
    setNow(new Date());
    setSkipped(getSkipped(date));
    const t = setInterval(() => setNow(new Date()), 60_000); // windows roll over while the app is open
    return () => clearInterval(t);
  }, [date]);
  if (!now) return <div className="card mb-3 h-[188px] animate-pulse !bg-gray-100" />;
  const h = now.getHours() + now.getMinutes() / 60;

  const steps = buildSteps({ h, journal, day, nnList }).filter((s) => !s.hidden);
  const next = priority(h).map((id) => steps.find((s) => s.id === id))
    .find((s) => s && !s.done && s.due && !skipped.includes(s.id));
  const doneCount = steps.filter((s) => s.done).length;
  const firstOpen = steps.find((s) => !s.done && !s.missed)?.id;
  const first = (name || "").split(" ")[0];

  function skip(id) {
    const n = [...skipped, id];
    setSkipped(n);
    try { localStorage.setItem(DISMISS(date), JSON.stringify(n)); } catch {}
  }

  function act(s) {
    if (s.meal) onLogMeal(s.meal);
    else if (s.anchor) document.getElementById(s.anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="card mb-3 overflow-hidden !p-0">
      <div className="bg-lock px-4 pb-3 pt-4 text-white">
        <div className="text-[12px] text-white/70">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h2 className="text-xl font-bold">{greeting(now.getHours())}{first ? `, ${first}` : ""}</h2>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-white/80">{doneCount}/{steps.length} today</span>
        </div>
      </div>

      <div className="p-4">
        {next ? (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-lock-light">Next up</div>
            <div className="mt-0.5 flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lock-faint text-lock">
                <Icon name={next.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{next.title}</div>
                {next.sub && <div className="text-[12px] text-gray-500">{next.sub}</div>}
                {next.progress > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-lock-light" style={{ width: `${next.progress * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {next.href
                ? <Link href={next.href} className="btn-primary flex-1 py-2.5 text-sm">{next.cta}</Link>
                : <button className="btn-primary flex-1 py-2.5 text-sm" onClick={() => act(next)}>{next.cta}</button>}
              <button className="btn-ghost px-4 py-2.5 text-sm" onClick={() => skip(next.id)}>Not now</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lock-faint text-lock">
              <Icon name="check" className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div>
              <div className="font-bold">{doneCount === steps.length ? "Everything's locked in today" : "You're on track"}</div>
              <div className="text-[12px] text-gray-500">
                {doneCount === steps.length ? "Every step done. That's a good day — protect your sleep tonight." : "Nothing due right now. Keep going."}
              </div>
            </div>
          </div>
        )}

        {/* The whole day at a glance */}
        <div ref={rowRef} className="no-scrollbar -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4">
          {steps.map((s) => {
            const state = s.done ? "done" : s.due ? "due" : s.missed ? "missed" : "later";
            const cls = {
              done: "bg-lock-faint text-lock",
              due: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
              missed: "bg-gray-50 text-gray-400 line-through decoration-gray-300",
              later: "bg-white text-gray-400 ring-1 ring-gray-200",
            }[state];
            const inner = (
              <>
                <Icon name={s.done ? "check" : s.icon} className="h-3.5 w-3.5" strokeWidth={s.done ? 2.6 : 1.8} />
                {s.label}
              </>
            );
            const base = `flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`;
            const mark = state === "due" || state === "later" ? { "data-now": "" } : {};
            if (s.done) return <span key={s.id} className={base}>{inner}</span>;
            return s.href
              ? <Link key={s.id} href={s.href} className={base} {...(firstOpen === s.id ? mark : {})}>{inner}</Link>
              : <button key={s.id} className={base} onClick={() => act(s)} {...(firstOpen === s.id ? mark : {})}>{inner}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
