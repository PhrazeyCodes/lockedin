"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Home", icon: "🏠" },
  { href: "/plan", label: "Plan", icon: "🗓" },
  { href: "/lift", label: "Lift", icon: "🏋️" },
  { href: "/journal", label: "Journal", icon: "📓" },
  { href: "/social", label: "Social", icon: "👥" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-gray-100 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-lock" : "text-gray-400"}`}>
              <span className={`text-xl ${active ? "" : "grayscale opacity-60"}`}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
