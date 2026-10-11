"use client";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import { markJournalDone } from "@/lib/store";
import { todayStr } from "@/lib/dates";
import Sheet from "@/components/Sheet";
import HistoryCalendar from "@/components/HistoryCalendar";
import Icon, { MOOD_VALUES, MOOD_ICONS } from "@/components/Icon";
import { showToast } from "@/components/Toast";
import NonNegotiables from "@/components/NonNegotiables";
import { activeNN, getNNList, nnDone, perfectStreak, patchJournal, tradingEnabled, buildRecords, analyze, taskStats } from "@/lib/journal";

// Stored values stay the original emoji so existing entries keep working;
// only the rendering is an icon now.
const MOODS = MOOD_VALUES;

function Mood({ value, className = "h-5 w-5" }) {
  if (!value || !MOOD_ICONS[value]) return null;
  return <Icon name={MOOD_ICONS[value]} className={className} />;
}

export default function Journal() {
  const { user, loading } = useUser();
  const [entry, setEntry] = useState(null); // today's row
  const [history, setHistory] = useState([]);
  const [flow, setFlow] = useState(null); // 'am' | 'pm'
  const [streak, setStreak] = useState(0);
  const [viewing, setViewing] = useState(null); // past entry being read
  const [calOpen, setCalOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [dayRows, setDayRows] = useState([]); // days.tasks for to-do completion
  const date = todayStr();

  async function refresh() {
    const [{ data }, { data: days }] = await Promise.all([
      supabase.from("journal").select("*")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(90),
      supabase.from("days").select("date, tasks")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(90),
    ]);
    const rows = data || [];
    setHistory(rows);
    setDayRows(days || []);
    setEntry(rows.find((r) => r.date === date) || null);
    // streak: consecutive days with an entry
    const has = new Set(rows.filter((r) => r.am || r.pm).map((r) => r.date));
    let s = 0, d = date;
    if (!has.has(d)) d = shiftDay(d, -1);
    while (has.has(d)) { s++; d = shiftDay(d, -1); }
    setStreak(s);
  }

  useEffect(() => { if (user) refresh(); }, [user]); // eslint-disable-line

  if (loading) return null;

  async function save(patch) {
    const row = { user_id: user.id, date, ...patch };
    await supabase.from("journal").upsert(row, { onConflict: "user_id,date" });
    await markJournalDone(user.id, date);
    setFlow(null);
    showToast("Journal saved");
    refresh();
  }

  async function saveSleep(sleep) {
    await patchJournal(user.id, date, { sleep });
    setSleepOpen(false);
    showToast("Sleep logged");
    refresh();
  }

  const weights = history.filter((h) => h.weight).slice(0, 30).reverse();
  const nnList = activeNN(getNNList());
  const trading = tradingEnabled();
  const insights = analyze(buildRecords(history, dayRows, nnList), nnList, { trading });
  const perfect = perfectStreak(history, nnList);
  const todayTasks = taskStats(dayRows.find((d) => d.date === date));
  const shown = history.filter((h) => h.am || h.pm || h.sleep || h.weight || h.mood);

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal</h1>
        <div className="flex items-center gap-2">
          <button aria-label="History" className="rounded-full bg-white p-2 text-gray-700 shadow-card active:scale-95"
            onClick={() => setCalOpen(true)}><Icon name="calendar" className="h-[18px] w-[18px]" /></button>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-card">
            <Icon name="notebook" className="h-4 w-4 text-lock" /> {streak} day streak
          </span>
        </div>
      </div>

      <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-[11px] text-gray-500">
        <Icon name="lock" className="h-3.5 w-3.5" /> Always private. Friends only ever see "journaled today".
      </p>

      <div className="mb-3">
        <NonNegotiables uid={user?.id} date={date} onChange={refresh} />
        {perfect > 0 && (
          <p className="mt-1.5 px-1 text-[11px] font-semibold text-lock">
            <Icon name="flame" className="mr-1 inline h-3.5 w-3.5" />{perfect} perfect day{perfect > 1 ? "s" : ""} in a row
          </p>
        )}
      </div>

      <button onClick={() => setSleepOpen(true)}
        className={`card mb-3 flex w-full items-center gap-3 text-left active:scale-[0.99] ${entry?.sleep ? "ring-2 ring-lock-light" : ""}`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon name="bed" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Sleep</div>
          <div className="text-[11px] text-gray-500">
            {entry?.sleep
              ? [entry.sleep.hours && `${entry.sleep.hours}h`, entry.sleep.score && `score ${entry.sleep.score}`,
                 entry.sleep.readiness && `readiness ${entry.sleep.readiness}`].filter(Boolean).join(" · ")
              : "Log last night from your Oura app"}
          </div>
        </div>
        <span className="text-sm font-medium text-lock-light">{entry?.sleep ? "Edit" : "Log"}</span>
      </button>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <button onClick={() => setFlow("am")}
          className={`card text-left active:scale-95 ${entry?.am ? "ring-2 ring-lock-light" : ""}`}>
          <Icon name="sunrise" className="h-6 w-6 text-gray-700" />
          <div className="mt-1 font-bold">Morning</div>
          <div className="text-[11px] text-gray-500">{entry?.am ? "Done — tap to edit" : "Intentions · gratitude · focus"}</div>
        </button>
        <button onClick={() => setFlow("pm")}
          className={`card text-left active:scale-95 ${entry?.pm ? "ring-2 ring-lock-light" : ""}`}>
          <Icon name="moon" className="h-6 w-6 text-gray-700" />
          <div className="mt-1 font-bold">Night</div>
          <div className="text-[11px] text-gray-500">{entry?.pm ? `Done${entry.pm.rating ? ` · rated ${entry.pm.rating}/10` : ""} — tap to edit` : "Rate the day · to-do · wins"}</div>
        </button>
      </div>

      {weights.length > 1 && (
        <div className="card mb-3">
          <h3 className="mb-1 font-bold">Weight</h3>
          <WeightChart data={weights} />
        </div>
      )}

      <Insights data={insights} />

      <h3 className="mb-2 mt-5 font-bold">History</h3>
      {!shown.length && <p className="py-4 text-center text-sm text-gray-400">No entries yet.</p>}
      <div className="space-y-2">
        {shown.map((h) => (
          <button key={h.date} className="card flex w-full items-center gap-3 py-3 text-left active:scale-[0.99]"
            onClick={() => setViewing(h)}>
            <span className="flex items-center gap-1 text-gray-600">
              {(h.am?.mood || h.pm?.mood)
                ? <>
                    {h.am?.mood && <><Icon name="sunrise" className="h-4 w-4" /><Mood value={h.am.mood} /></>}
                    {h.pm?.mood && <><Icon name="moon" className="h-4 w-4" /><Mood value={h.pm.mood} /></>}
                  </>
                : (h.mood ? <Mood value={h.mood} /> : <span className="text-gray-300">·</span>)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {new Date(h.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-500">
                {h.am && <Icon name="sunrise" className="h-3.5 w-3.5" />}
                {h.pm && <Icon name="moon" className="h-3.5 w-3.5" />}
                {h.weight && <><Icon name="scale" className="h-3.5 w-3.5" /> {h.weight} lb</>}
                {h.sleep?.hours && <><Icon name="bed" className="ml-1 h-3.5 w-3.5" /> {h.sleep.hours}h</>}
                {nnList.length > 0 && h.nn && <><Icon name="target" className="ml-1 h-3.5 w-3.5" /> {nnDone(h, nnList)}/{nnList.length}</>}
              </div>
            </div>
            {h.pm?.rating
              ? <RatingChip value={h.pm.rating} />
              : h.am?.focus && <span className="max-w-[40%] truncate text-[11px] text-gray-400">"{h.am.focus}"</span>}
            <span className="text-gray-300">›</span>
          </button>
        ))}
      </div>

      <Flow flow={flow} entry={entry} tasks={todayTasks} trading={trading}
        onClose={() => setFlow(null)} onSave={save} />
      <SleepSheet open={sleepOpen} sleep={entry?.sleep} onClose={() => setSleepOpen(false)} onSave={saveSleep} />
      <EntryViewer entry={viewing} nnList={nnList} onClose={() => setViewing(null)}
        onEdit={viewing?.date === date ? (which) => { setViewing(null); setFlow(which); } : null} />
      <HistoryCalendar open={calOpen} onClose={() => setCalOpen(false)} uid={user?.id} source="journal"
        onPick={(d) => {
          const h = history.find((x) => x.date === d);
          if (h) setViewing(h);
          else showToast("No entry that day");
        }} />
    </div>
  );
}

function RatingChip({ value }) {
  const v = +value;
  const tone = v >= 7 ? "bg-lock-faint text-lock" : v <= 5 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{v}/10</span>;
}

function Field({ label, children }) {
  return (
    <div className="mb-1.5 rounded-xl bg-gray-50 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{children}</div>
    </div>
  );
}

function EntryViewer({ entry, nnList = [], onClose, onEdit }) {
  if (!entry) return null;
  const AM = [["intentions", "Intentions"], ["gratitude", "Gratitude"], ["focus", "Focus"]];
  const PM = [["tasks_note", "How the to-do went"], ["wins", "Wins"], ["improve", "To improve"], ["thoughts", "Thoughts"]];
  const pm = entry.pm || {};
  const trade = pm.trade;
  return (
    <Sheet open onClose={onClose}
      title={new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        {pm.rating && <RatingChip value={pm.rating} />}
        {!entry.am?.mood && !pm.mood && entry.mood && <Mood value={entry.mood} className="h-6 w-6" />}
        {entry.weight && <span className="flex items-center gap-1.5"><Icon name="scale" className="h-4 w-4" /> {entry.weight} lb</span>}
        {entry.sleep?.hours && <span className="flex items-center gap-1.5"><Icon name="bed" className="h-4 w-4" /> {entry.sleep.hours}h
          {entry.sleep.score && ` · ${entry.sleep.score}`}{entry.sleep.readiness && ` · R${entry.sleep.readiness}`}</span>}
        {pm.energy && <span className="flex items-center gap-1.5"><Icon name="zap" className="h-4 w-4" /> {pm.energy}/5</span>}
        {pm.deep_work && <span className="flex items-center gap-1.5"><Icon name="clock" className="h-4 w-4" /> {pm.deep_work}h deep</span>}
      </div>
      {nnList.length > 0 && entry.nn && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {nnList.map((i) => (
            <span key={i.id} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${entry.nn[i.id] ? "bg-lock-faint text-lock" : "bg-gray-100 text-gray-400 line-through"}`}>
              {i.label}
            </span>
          ))}
        </div>
      )}
      {entry.am && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-bold">
              <Icon name="sunrise" className="h-[18px] w-[18px]" /> Morning <Mood value={entry.am.mood} />
            </h3>
            {onEdit && <button className="text-sm font-medium text-lock-light" onClick={() => onEdit("am")}>Edit</button>}
          </div>
          {AM.map(([k, label]) => entry.am[k] && <Field key={k} label={label}>{entry.am[k]}</Field>)}
        </div>
      )}
      {entry.pm && (
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-bold">
              <Icon name="moon" className="h-[18px] w-[18px]" /> Night <Mood value={pm.mood} />
            </h3>
            {onEdit && <button className="text-sm font-medium text-lock-light" onClick={() => onEdit("pm")}>Edit</button>}
          </div>
          {pm.tasks_total > 0 && <Field label="To-do">Cleared {pm.tasks_done}/{pm.tasks_total}</Field>}
          {PM.map(([k, label]) => pm[k] && <Field key={k} label={label}>{pm[k]}</Field>)}
          {trade?.traded && (
            <Field label="Trading">
              {trade.followed ? "Followed my rules" : "Broke my rules"}
              {trade.r !== "" && trade.r != null && ` · ${+trade.r > 0 ? "+" : ""}${trade.r}R`}
              {trade.note && `\n${trade.note}`}
            </Field>
          )}
          {trade && !trade.traded && <Field label="Trading">No trades today</Field>}
        </div>
      )}
      {!entry.am && !entry.pm && <p className="py-4 text-center text-sm text-gray-400">No morning or night entry that day.</p>}
    </Sheet>
  );
}

function shiftDay(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SleepSheet({ open, sleep, onClose, onSave }) {
  const [s, setS] = useState({});
  useEffect(() => { if (open) setS(sleep || {}); }, [open, sleep]);
  if (!open) return null;
  const num = (k, v) => setS({ ...s, [k]: v.replace(/[^0-9.]/g, "") });
  const fields = [["hours", "Hours slept", "7.5"], ["score", "Sleep score", "82"], ["readiness", "Readiness", "78"]];
  return (
    <Sheet open onClose={onClose} title={<span className="flex items-center gap-2"><Icon name="bed" className="h-5 w-5" /> Last night's sleep</span>}>
      <p className="mb-3 text-[12px] text-gray-500">Open your Oura app and copy today's numbers. Hours matter most — the rest is optional.</p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {fields.map(([k, label, ph]) => (
          <div key={k}>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
            <input className="input px-2 text-center" type="text" inputMode="decimal" placeholder={ph}
              value={s[k] ?? ""} onChange={(e) => num(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
        <button className="btn-primary flex-1" onClick={() => onSave({
          hours: s.hours ? +s.hours : null, score: s.score ? +s.score : null, readiness: s.readiness ? +s.readiness : null,
        })}>Save</button>
      </div>
    </Sheet>
  );
}

function Scale({ n, value, onPick, label }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-600">{label}</label>
      <div className="flex gap-1">
        {Array.from({ length: n }, (_, i) => i + 1).map((v) => (
          <button key={v} onClick={() => onPick(v)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold transition active:scale-90 ${
              +value === v ? "bg-lock text-white" : "bg-gray-100 text-gray-500"}`}>{v}</button>
        ))}
      </div>
    </div>
  );
}

function Flow({ flow, entry, tasks, trading, onClose, onSave }) {
  const [data, setData] = useState({});
  const [mood, setMood] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (!flow) return;
    setData(entry?.[flow] || {});
    // Each flow keeps its own mood (falls back to the old shared column for old entries)
    setMood(entry?.[flow]?.mood || "");
    setWeight(entry?.weight || "");
  }, [flow, entry]);

  if (!flow) return null;
  const am = flow === "am";
  const set = (k, v) => setData({ ...data, [k]: v });
  const trade = data.trade || {};
  const setTrade = (patch) => set("trade", { ...trade, ...patch });
  const fields = am
    ? [["intentions", "Today's intentions (1–3)"], ["gratitude", "Grateful for (1–3)"], ["focus", "One-line focus for the day"]]
    : [["wins", "Wins today"], ["improve", "What to improve"], ["thoughts", "Free thoughts"]];

  function submit() {
    const out = { ...data, mood: mood || null };
    if (!am) { out.tasks_done = tasks.done; out.tasks_total = tasks.total; }
    onSave({ [flow]: out, mood: mood || null, weight: weight ? +weight : null });
  }

  return (
    <Sheet open onClose={onClose}
      title={<span className="flex items-center gap-2">
        <Icon name={am ? "sunrise" : "moon"} className="h-5 w-5" /> {am ? "Morning" : "Night"}
      </span>}>
      <div className="space-y-3">
        {!am && (
          <>
            <Scale n={10} label="Rate today" value={data.rating} onPick={(v) => set("rating", v)} />
            <Scale n={5} label="Energy" value={data.energy} onPick={(v) => set("energy", v)} />
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">To-do list</span>
                <span className={`text-sm font-bold ${tasks.total && tasks.done === tasks.total ? "text-lock-light" : "text-gray-700"}`}>
                  {tasks.total ? `${tasks.done}/${tasks.total} cleared` : "No tasks in Plan today"}
                </span>
              </div>
              <textarea className="input min-h-[60px] bg-white" placeholder="How did your tasks go? What got in the way?"
                value={data.tasks_note || ""} onChange={(e) => set("tasks_note", e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-gray-600">Deep work (hours)</label>
              <input className="input !w-24 text-center" type="text" inputMode="decimal" placeholder="0"
                value={data.deep_work ?? ""} onChange={(e) => set("deep_work", e.target.value.replace(/[^0-9.]/g, ""))} />
            </div>
            {trading && (
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-600">
                  <Icon name="trendingUp" className="h-4 w-4" /> Trading
                </div>
                <div className="mb-2 flex gap-1">
                  {[[true, "Traded"], [false, "No trades"]].map(([v, l]) => (
                    <button key={l} onClick={() => setTrade({ traded: v })}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold ${trade.traded === v ? "bg-lock text-white" : "bg-white text-gray-500"}`}>{l}</button>
                  ))}
                </div>
                {trade.traded && (
                  <>
                    <div className="mb-2 flex gap-1">
                      {[[true, "Followed rules"], [false, "Broke rules"]].map(([v, l]) => (
                        <button key={l} onClick={() => setTrade({ followed: v })}
                          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${trade.followed === v
                            ? (v ? "bg-lock text-white" : "bg-red-500 text-white") : "bg-white text-gray-500"}`}>{l}</button>
                      ))}
                    </div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm text-gray-600">Result (R)</label>
                      <input className="input !w-24 bg-white text-center" type="text" inputMode="decimal" placeholder="+1.5"
                        value={trade.r ?? ""} onChange={(e) => setTrade({ r: e.target.value.replace(/[^0-9.\-]/g, "") })} />
                    </div>
                    <textarea className="input min-h-[50px] bg-white" placeholder="What happened? Which rule, if any, did you break?"
                      value={trade.note || ""} onChange={(e) => setTrade({ note: e.target.value })} />
                  </>
                )}
              </div>
            )}
          </>
        )}
        {fields.map(([k, label]) => (
          <div key={k}>
            <label className="mb-1 block text-sm font-medium text-gray-600">{label}</label>
            <textarea className="input min-h-[60px]" value={data[k] || ""}
              onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button key={m} aria-label={`Mood ${MOODS.indexOf(m) + 1} of 5`} onClick={() => setMood(m)}
                className={`rounded-full p-1.5 ${mood === m ? "bg-lock-faint text-lock ring-2 ring-lock-light" : "text-gray-400"}`}>
                <Mood value={m} className="h-7 w-7" />
              </button>
            ))}
          </div>
          {am && (
            <input className="input !w-28 shrink-0" type="number" inputMode="decimal" placeholder="Weight"
              value={weight} onChange={(e) => setWeight(e.target.value)} />
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Skip</button>
          <button className="btn-primary flex-1" onClick={submit}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

// "Why are some days good?" — compares days you rated 7+ against days rated 5 or less.
function Insights({ data }) {
  const [open, setOpen] = useState(false);
  if (!data.total) {
    return (
      <div className="card mb-3">
        <h3 className="flex items-center gap-1.5 font-bold"><Icon name="sparkles" className="h-[18px] w-[18px] text-lock" /> Good day formula</h3>
        <p className="mt-1 text-[12px] text-gray-500">Rate each day in your Night entry. After a week or two, this shows what your best days have in common.</p>
      </div>
    );
  }
  return (
    <div className="card mb-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-bold"><Icon name="sparkles" className="h-[18px] w-[18px] text-lock" /> Good day formula</h3>
        <span className="text-[11px] text-gray-400">{data.total} rated · avg {data.avgRating.toFixed(1)}</span>
      </div>
      {!data.ready ? (
        <p className="text-[12px] text-gray-500">
          Need at least 2 good days (7+) and 2 off days (5 or less) to compare — you have {data.good} good and {data.off} off so far. Keep rating honestly.
        </p>
      ) : (
        <>
          {data.takeaways.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {data.takeaways.map((t) => (
                <p key={t} className="rounded-xl bg-lock-faint px-3 py-2 text-[12px] font-medium text-lock">{t}</p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Factor</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-lock-light">Good ({data.good})</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-red-500">Off ({data.off})</span>
            {data.factors.map((f) => (
              <Row key={f.key} label={f.label} good={f.good != null ? f.fmt(f.good) : "—"} off={f.off != null ? f.fmt(f.off) : "—"} />
            ))}
          </div>
        </>
      )}
      {data.items.length > 0 && (
        <>
          <button className="mt-2 text-sm font-medium text-lock-light" onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Which non-negotiable matters most?"}
          </button>
          {open && (
            <div className="mt-2 space-y-1.5">
              {data.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
                  <span className="truncate">{i.label}</span>
                  <span className={`shrink-0 font-semibold ${i.lift > 0 ? "text-lock-light" : "text-gray-400"}`}>
                    {i.lift > 0 ? "+" : ""}{i.lift.toFixed(1)}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-gray-400">Average day rating when you did it minus when you skipped it.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, good, off }) {
  return (
    <>
      <span className="text-gray-600">{label}</span>
      <span className="text-right font-semibold">{good}</span>
      <span className="text-right font-semibold text-gray-500">{off}</span>
    </>
  );
}

function WeightChart({ data }) {
  const w = 320, h = 80, pad = 6;
  const vals = data.map((d) => +d.weight);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => [
    pad + (i * (w - 2 * pad)) / (vals.length - 1),
    h - pad - ((v - min) / span) * (h - 2 * pad),
  ]);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <polyline fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round"
          points={pts.map((p) => p.join(",")).join(" ")} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#14532d" />)}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{vals[0]} lb</span><span>{vals.at(-1)} lb</span>
      </div>
    </div>
  );
}