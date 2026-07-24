"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import Icon, { REACTION_ICONS } from "@/components/Icon";
import { SEEN_KEY, EVENT_LABELS as LABELS } from "@/lib/notifications";

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Notifications() {
  const { user, loading } = useUser();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLastSeen(localStorage.getItem(SEEN_KEY));
      const [{ data: rx }, { data: lk }] = await Promise.all([
        supabase.from("reactions")
          .select("id, emoji, comment, user_id, created_at, feed_events!inner(user_id, type, date)")
          .eq("feed_events.user_id", user.id).neq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(50),
        supabase.from("likes")
          .select("event_id, user_id, created_at, feed_events!inner(user_id, type, date)")
          .eq("feed_events.user_id", user.id).neq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(50),
      ]);

      const rows = [
        ...(rx || []).map((r) => ({
          id: `r-${r.id}`, kind: r.comment ? "comment" : "reaction",
          who: r.user_id, at: r.created_at, emoji: r.emoji, comment: r.comment,
          on: LABELS[r.feed_events?.type] || "your post",
        })),
        ...(lk || []).map((l) => ({
          id: `l-${l.event_id}-${l.user_id}`, kind: "like",
          who: l.user_id, at: l.created_at,
          on: LABELS[l.feed_events?.type] || "your post",
        })),
      ].sort((a, b) => (a.at < b.at ? 1 : -1));

      const ids = [...new Set(rows.map((r) => r.who))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, display_name").in("id", ids)
        : { data: [] };
      const names = Object.fromEntries((profs || []).map((p) => [p.id, p.display_name]));

      setItems(rows.map((r) => ({ ...r, name: names[r.who] || "A friend" })));
      setBusy(false);
      // everything on this screen counts as seen
      localStorage.setItem(SEEN_KEY, new Date().toISOString());
    })();
  }, [user]);

  if (loading) return null;

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/home" aria-label="Back" className="rounded-full bg-white p-2 text-gray-700 shadow-card active:scale-95">
          <Icon name="x" className="h-[18px] w-[18px]" />
        </Link>
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {busy && <p className="py-8 text-center text-sm text-gray-400">Loading…</p>}
      {!busy && !items.length && (
        <div className="card text-center">
          <div className="flex justify-center text-gray-300"><Icon name="bell" className="h-8 w-8" /></div>
          <p className="mt-2 text-sm text-gray-500">Nothing yet.</p>
          <p className="text-[11px] text-gray-400">Likes, reactions and comments on your posts land here.</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((n) => {
          const fresh = lastSeen && n.at > lastSeen;
          return (
            <div key={n.id}
              className={`card flex items-start gap-3 py-3 ${fresh ? "ring-2 ring-lock-light" : ""}`}>
              <span className={`mt-0.5 ${n.kind === "like" ? "text-red-500" : "text-gray-400"}`}>
                {n.kind === "like" && <Icon name="heart" className="h-[18px] w-[18px]" filled />}
                {n.kind === "comment" && <Icon name="message" className="h-[18px] w-[18px]" />}
                {n.kind === "reaction" && <Icon name={REACTION_ICONS[n.emoji] || "flame"} className="h-[18px] w-[18px]" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <b>{n.name}</b>{" "}
                  {n.kind === "like" && <>liked {n.on}</>}
                  {n.kind === "comment" && <>commented on {n.on}</>}
                  {n.kind === "reaction" && <>reacted to {n.on}</>}
                </p>
                {n.comment && <p className="text-[12px] italic text-gray-500">"{n.comment}"</p>}
                <p className="text-[11px] text-gray-400">{timeAgo(n.at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}