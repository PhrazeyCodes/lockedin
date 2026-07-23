export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export function fmtDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const today = todayStr();
  if (dateStr === today) return "Today";
  if (dateStr === addDays(today, -1)) return "Yesterday";
  if (dateStr === addDays(today, 1)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function fmtDateLong(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function weekDates(anchor = todayStr()) {
  // Mon-first week containing anchor
  const d = new Date(anchor + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // Mon=0
  const start = addDays(anchor, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const DOW_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
