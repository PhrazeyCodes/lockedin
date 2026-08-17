// Meal slots. A food is filed automatically by the time it was logged, and the
// user can override that — `slot` on the meal wins over the time-based guess.

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export const MEAL_ICONS = {
  breakfast: "sunrise",
  lunch: "bowl",
  dinner: "moon",
  snack: "zap",
};

// 4:00–10:59 breakfast · 11:00–15:59 lunch · 16:00–21:59 dinner · late night snack
export function slotForTime(ts) {
  const h = new Date(ts || Date.now()).getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 22) return "dinner";
  return "snack";
}

// Where a meal currently sits: explicit choice first, otherwise the time guess.
export function slotOf(meal) {
  return MEAL_SLOTS.includes(meal?.slot) ? meal.slot : slotForTime(meal?.ts);
}

// Meals grouped into slot order, each with its own totals. Empty slots are dropped.
export function groupMeals(meals) {
  const by = Object.fromEntries(MEAL_SLOTS.map((s) => [s, []]));
  for (const m of meals || []) by[slotOf(m)].push(m);
  return MEAL_SLOTS
    .filter((s) => by[s].length)
    .map((s) => ({
      slot: s,
      label: MEAL_LABELS[s],
      icon: MEAL_ICONS[s],
      meals: by[s],
      kcal: Math.round(by[s].reduce((n, m) => n + (+m.kcal || 0), 0)),
      p: Math.round(by[s].reduce((n, m) => n + (+m.p || 0), 0)),
    }));
}
