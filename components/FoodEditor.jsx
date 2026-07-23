"use client";
import { useState, useMemo } from "react";

// Every logging path lands here. `initial`: {name, brand, qty, unit, per100?, kcal, p, c, f}
// per100 present → gram-scaling; otherwise macros are per-serving and scale by qty.
export default function FoodEditor({ initial, onSave, onCancel, saveLabel = "Log it" }) {
  const [name, setName] = useState(initial.name || "");
  const [brand, setBrand] = useState(initial.brand || "");
  const [qty, setQty] = useState(initial.qty ?? (initial.per100 ? 100 : 1));
  const [unit, setUnit] = useState(initial.unit || (initial.per100 ? "g" : "serving"));
  const [manual, setManual] = useState(
    initial.per100 ? null : { kcal: initial.kcal || 0, p: initial.p || 0, c: initial.c || 0, f: initial.f || 0 }
  );

  const scaled = useMemo(() => {
    if (initial.per100 && unit === "g") {
      const k = (qty || 0) / 100;
      return {
        kcal: Math.round(initial.per100.kcal * k),
        p: Math.round(initial.per100.p * k * 10) / 10,
        c: Math.round(initial.per100.c * k * 10) / 10,
        f: Math.round(initial.per100.f * k * 10) / 10,
      };
    }
    const base = manual || { kcal: initial.kcal || 0, p: initial.p || 0, c: initial.c || 0, f: initial.f || 0 };
    const k = unit === "serving" ? qty || 0 : 1;
    return {
      kcal: Math.round(base.kcal * k),
      p: Math.round(base.p * k * 10) / 10,
      c: Math.round(base.c * k * 10) / 10,
      f: Math.round(base.f * k * 10) / 10,
    };
  }, [qty, unit, manual, initial]);

  const tiles = [
    { key: "kcal", label: "kcal", color: "text-gray-900" },
    { key: "p", label: "Protein", color: "text-red-500" },
    { key: "c", label: "Carbs", color: "text-amber-500" },
    { key: "f", label: "Fat", color: "text-blue-500" },
  ];

  return (
    <div className="space-y-3">
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Food name" />
      <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" />
      <div className="flex gap-2">
        <input className="input min-w-0 flex-1" type="number" inputMode="decimal" value={qty} min={0}
          onChange={(e) => setQty(+e.target.value)} />
        <select className="input !w-auto shrink-0" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {initial.per100 && <option value="g">grams</option>}
          <option value="serving">servings</option>
        </select>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-xl bg-gray-50 p-2 text-center">
            {manual && unit !== "g" ? (
              <input type="number" inputMode="decimal"
                className={`w-full bg-transparent text-center text-lg font-bold outline-none ${t.color}`}
                value={manual[t.key]}
                onChange={(e) => setManual({ ...manual, [t.key]: +e.target.value })} />
            ) : (
              <div className={`text-lg font-bold ${t.color}`}>{scaled[t.key]}</div>
            )}
            <div className="text-[10px] text-gray-500">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-primary flex-1" disabled={!name}
          onClick={() => onSave({
            id: initial.id || crypto.randomUUID(),
            name, brand, qty, unit,
            per100: initial.per100 || null,
            kcal: scaled.kcal, p: scaled.p, c: scaled.c, f: scaled.f,
            photo: initial.photo || null,
            ts: initial.ts || Date.now(),
          })}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}