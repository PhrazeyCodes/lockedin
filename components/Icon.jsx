"use client";

// Minimal line-icon set. Zero dependencies: every icon is a 24x24 stroke path
// that inherits the current text colour, so <Icon name="flame" /> styles like text.
//
// Values in ICONS are drawing instructions:
//   "M…"            → <path d="…" />
//   [cx, cy, r]     → <circle …/>
const ICONS = {
  // nav
  home: ["M3 10.5 12 3l9 7.5", "M5.5 9.5V20h13V9.5", "M10 20v-5h4v5"],
  calendar: ["M4 6.5h16v14H4z", "M8 3.5v4M16 3.5v4M4 11h16"],
  barbell: ["M4 9v6M7.5 6v12M16.5 6v12M20 9v6M7.5 12h9"],
  notebook: ["M6 3.5h13v17H6z", "M6 8H3.5M6 12H3.5M6 16H3.5"],
  users: [[9, 8, 3.2], "M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5", "M16 5.5a3 3 0 0 1 0 5.5", "M17.5 15.5c1.9.7 3 2.3 3 4.5"],

  // status / stats
  flame: ["M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.6.7-2.9 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-7Z"],
  droplet: ["M12 3.5c3 3.6 5 6.1 5 8.7a5 5 0 0 1-10 0c0-2.6 2-5.1 5-8.7Z"],
  circleEmpty: [[12, 12, 7]],
  bowl: ["M3.5 11h17a8.5 8.5 0 0 1-17 0Z", "M8 7.5c0-1 .8-1.5.8-2.5M12 7c0-1.2 1-1.8 1-3M16 7.5c0-1 .8-1.5.8-2.5"],
  scale: ["M4.5 4.5h15l1.5 15h-18z", "M8.5 9.5a4.5 4.5 0 0 1 7 0", "M12 12.5V10"],
  trendingUp: ["M3.5 16.5 10 10l3.5 3.5L20.5 6.5", "M15.5 6.5h5v5"],
  target: [[12, 12, 8], [12, 12, 3.5], [12, 12, 0.6]],
  clipboard: ["M8.5 4.5H7A1.5 1.5 0 0 0 5.5 6v13A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-1.5", "M9 3h6v3H9z", "M9 11h6M9 15h4"],
  crown: ["M3.5 8.5l3.5 3 5-6.5 5 6.5 3.5-3-2 10h-13z"],
  trophy: ["M8 4.5h8v4a4 4 0 0 1-8 0z", "M8 6H5.5a2.5 2.5 0 0 0 2.5 4.5M16 6h2.5A2.5 2.5 0 0 1 16 10.5", "M12 12.5V16M9 20h6M10.5 16h3"],

  // time of day
  sunrise: [[12, 14, 3.5], "M12 5v3M5.5 14H3M21 14h-2.5M6.8 8.8 5.2 7.2M17.2 8.8l1.6-1.6", "M3.5 19h17"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"],
  bed: ["M3.5 19v-9M3.5 14h17v5M20.5 19v-5a3 3 0 0 0-3-3H3.5", [8, 8.5, 2]],
  clock: [[12, 12, 8], "M12 8v4.3l3 1.8"],
  run: [[14.5, 5, 1.8], "M16.8 8.6 12.8 10l1.2 3.6-3.2 2.6L9.2 20.5", "M13.2 9.6 9.4 7.4", "M14 13.6l2.8 2.4.6 3.6"],
  route: [[5.5, 6, 2.5], [18.5, 18, 2.5], "M8 6h6.5a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7H16"],

  // actions
  check: ["M5 12.5 9.5 17 19 7.5"],
  x: ["M6 6l12 12M18 6 6 18"],
  plus: ["M12 5v14M5 12h14"],
  camera: ["M3.5 8.5A2 2 0 0 1 5.5 6.5h1.7l1.3-2h7l1.3 2h1.7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z", [12, 13, 3.6]],
  image: ["M4 4.5h16v15H4z", [9, 10, 1.8], "M5 17.5 10 13l3 2.5 3-2.5 3 3"],
  message: ["M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.2-2.9-.4L4.5 20.5l1-3.3A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z"],
  search: [[10.5, 10.5, 6], "M15 15l5 5"],
  zap: ["M13.5 3 5.5 13.5H11l-.5 7.5 8-10.5H13z"],
  mic: ["M12 4.5a2.8 2.8 0 0 1 2.8 2.8v4a2.8 2.8 0 0 1-5.6 0v-4A2.8 2.8 0 0 1 12 4.5Z", "M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3.5M9 20.5h6"],
  pencil: ["M16.5 4.5l3 3-11 11H5.5v-3z", "M14.5 6.5l3 3"],
  eye: ["M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z", [12, 12, 3]],
  lock: ["M6.5 11h11v9.5h-11z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  sliders: ["M4 7h9M17 7h3M4 17h3M11 17h9", [15, 7, 2], [9, 17, 2]],
  sparkles: ["M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z", "M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],

  // moods (values stay the original emoji in the DB — only the rendering changed)
  mood1: [[12, 12, 8.5], [9.2, 10, 0.7], [14.8, 10, 0.7], "M8.5 16.2c1-1.6 2.1-2.4 3.5-2.4s2.5.8 3.5 2.4"],
  mood2: [[12, 12, 8.5], [9.2, 10, 0.7], [14.8, 10, 0.7], "M8.8 15.4c.9-.9 1.9-1.3 3.2-1.3s2.3.4 3.2 1.3"],
  mood3: [[12, 12, 8.5], [9.2, 10, 0.7], [14.8, 10, 0.7], "M9 15h6"],
  mood4: [[12, 12, 8.5], [9.2, 10, 0.7], [14.8, 10, 0.7], "M8.5 13.8c1 1.6 2.1 2.4 3.5 2.4s2.5-.8 3.5-2.4"],
  mood5: [[12, 12, 8.5], [9.2, 9.8, 0.7], [14.8, 9.8, 0.7], "M8 13.4c1.1 2 2.4 3 4 3s2.9-1 4-3z"],
};

export default function Icon({ name, className = "h-5 w-5", strokeWidth = 1.8 }) {
  const parts = ICONS[name];
  if (!parts) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`${className} shrink-0`}>
      {parts.map((p, i) =>
        Array.isArray(p)
          ? <circle key={i} cx={p[0]} cy={p[1]} r={p[2]} />
          : <path key={i} d={p} />
      )}
    </svg>
  );
}

// Mood values are stored as the original emoji for backwards compatibility.
export const MOOD_VALUES = ["😞", "😕", "😐", "🙂", "😄"];
export const MOOD_ICONS = { "😞": "mood1", "😕": "mood2", "😐": "mood3", "🙂": "mood4", "😄": "mood5" };

// Reaction values are likewise stored unchanged.
export const REACTION_VALUES = ["🔥", "💪", "👑"];
export const REACTION_ICONS = { "🔥": "flame", "💪": "barbell", "👑": "crown" };