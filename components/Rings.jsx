"use client";

export function Ring({ value, max, size = 72, stroke = 8, color = "#16a34a", children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export default function Rings({ totals, targets }) {
  const left = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const macros = [
    { key: "p", label: "Protein", color: "#ef4444", value: totals.p, max: targets.p },
    { key: "c", label: "Carbs", color: "#f59e0b", value: totals.c, max: targets.c },
    { key: "f", label: "Fat", color: "#3b82f6", value: totals.f, max: targets.f },
  ];
  return (
    <div className="card flex items-center gap-5">
      <Ring value={totals.kcal} max={targets.kcal} size={128} stroke={11} color="#14532d">
        <span className="text-3xl font-bold leading-none">{left}</span>
        <span className="text-[11px] text-gray-500">kcal left</span>
      </Ring>
      <div className="flex flex-1 justify-between">
        {macros.map((m) => (
          <div key={m.key} className="flex flex-col items-center gap-1">
            <Ring value={m.value} max={m.max} size={60} stroke={6} color={m.color}>
              <span className="text-xs font-bold">{Math.round(m.value)}</span>
            </Ring>
            <span className="text-[11px] text-gray-500">{m.label}</span>
            <span className="text-[10px] text-gray-400">/{m.max}g</span>
          </div>
        ))}
      </div>
    </div>
  );
}
