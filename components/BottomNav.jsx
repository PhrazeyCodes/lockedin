"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { SOCIAL_SEEN_KEY } from "@/lib/notifications";

const TABS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/plan", label: "Plan", icon: "calendar" },
  { href: "/lift", label: "Activity", icon: "barbell" },
  { href: "/journal", label: "Journal", icon: "notebook" },
  { href: "/social", label: "Social", icon: "users" },
];

export default function BottomNav() {
  const path = usePathname();
  const { user } = useUser();
  const [unread, setUnread] = useState(0);

  // Friends' posts since you last opened the feed. Recounted on every navigation,
  // so it stays current as you move around the app.
  useEffect(() => {
    if (!user) return;
    if (path.startsWith("/social")) { setUnread(0); return; }
    (async () => {
      const lastSeen = localStorage.getItem(SOCIAL_SEEN_KEY);
      if (!lastSeen) { localStorage.setItem(SOCIAL_SEEN_KEY, new Date().toISOString()); return; }
      const { data: fr } = await supabase.from("friendships").select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const friendIds = (fr || []).filter((r) => r.status === "accepted")
        .map((r) => (r.user_a === user.id ? r.user_b : r.user_a));
      if (!friendIds.length) { setUnread(0); return; }
      const { count } = await supabase.from("feed_events")
        .select("id", { count: "exact", head: true })
        .in("user_id", friendIds).gt("created_at", lastSeen);
      setUnread(count || 0);
    })();
  }, [user, path]);

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-gray-100 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          const badge = t.href === "/social" ? unread : 0;
          return (
            <Link key={t.href} href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-lock" : "text-gray-400"}`}>
              <span className="relative">
                <Icon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.7} />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}