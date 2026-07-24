// "Locked In" day grade from feed_events summaries.
// food logged 25 · trained/ran/rest logged 25 · habits% 20 · tasks% 20 · journal 10

export function dayScore(events) {
  let s = 0;
  const by = {};
  for (const e of events) by[e.type] = e.summary;
  if (by.food) s += 25;
  if (by.lift || by.run) s += 25;
  if (by.habits && by.habits.total > 0) s += Math.round(20 * (by.habits.done / by.habits.total));
  if (by.tasks && by.tasks.total > 0) s += Math.round(20 * (by.tasks.done / by.tasks.total));
  else if (by.tasks) s += 20;
  if (by.journal_done) s += 10;
  return Math.min(100, s);
}

export function gradeFor(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score > 0) return "D";
  return "—";
}

export function weeklyScore(eventsByDate) {
  const days = Object.values(eventsByDate);
  if (!days.length) return 0;
  const total = days.reduce((t, evs) => t + dayScore(evs), 0);
  return Math.round(total / days.length);
}