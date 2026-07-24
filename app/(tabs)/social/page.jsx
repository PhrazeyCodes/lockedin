"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import { todayStr, addDays } from "@/lib/dates";
import { dayScore, gradeFor } from "@/lib/score";
import Sheet from "@/components/Sheet";
import { showToast } from "@/components/Toast";

const EMOJIS = ["🔥", "💪", "👑"];

export default function Social() {
  const { user, profile, loading } = useUser();
  const [friends, setFriends] = useState([]);       // accepted profiles
  const [pendingIn, setPendingIn] = useState([]);   // requests to me
  const [events, setEvents] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [nudgedToday, setNudgedToday] = useState(new Set());
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [photoUrls, setPhotoUrls] = useState({});
  const [editorDate, setEditorDate] = useState(null); // date of own post being edited
  const [nudgeFor, setNudgeFor] = useState(null);     // friend profile being nudged
  const [myNudges, setMyNudges] = useState([]);       // nudges received today
  const [audioUrls, setAudioUrls] = useState({});     // signed urls for nudge voice memos

  async function refresh() {
    const me = user.id;
    const { data: fr } = await supabase.from("friendships").select("*")
      .or(`user_a.eq.${me},user_b.eq.${me}`);
    const rows = fr || [];
    const acceptedIds = rows.filter((r) => r.status === "accepted")
      .map((r) => (r.user_a === me ? r.user_b : r.user_a));
    const inReqs = rows.filter((r) => r.status === "pending" && r.requested_by !== me);

    const allIds = [...new Set([me, ...acceptedIds, ...inReqs.map((r) => (r.user_a === me ? r.user_b : r.user_a))])];
    const { data: profs } = await supabase.from("profiles")
      .select("id, username, display_name, goal_text, goal_weight, start_weight").in("id", allIds);
    const pmap = Object.fromEntries((profs || []).map((p) => [p.id, p]));

    setFriends(acceptedIds.map((id) => pmap[id]).filter(Boolean));
    setPendingIn(inReqs.map((r) => ({ ...r, profile: pmap[r.user_a === me ? r.user_b : r.user_a] })));

    const since = addDays(todayStr(), -13);
    const { data: evs } = await supabase.from("feed_events").select("*")
      .in("user_id", [me, ...acceptedIds]).gte("date", since)
      .order("date", { ascending: false }).order("created_at", { ascending: false });
    setEvents(evs || []);

    if (evs?.length) {
      const { data: rx } = await supabase.from("reactions").select("*").in("event_id", evs.map((e) => e.id));
      setReactions(rx || []);
      // signed urls for checkin + photo-update photos
      const paths = [];
      for (const e of evs) {
        if (e.type === "checkin" && e.summary?.photo_path) paths.push(e.summary.photo_path);
        if (e.type === "photos") for (const it of e.summary?.items || []) if (it.path) paths.push(it.path);
      }
      const urls = {};
      for (const p of paths) {
        const { data } = await supabase.storage.from("checkins").createSignedUrl(p, 3600);
        if (data?.signedUrl) urls[p] = data.signedUrl;
      }
      setPhotoUrls(urls);
    }

    const { data: nd } = await supabase.from("nudges").select("to_user").eq("from_user", me).eq("date", todayStr());
    setNudgedToday(new Set((nd || []).map((n) => n.to_user)));

    // nudges received today (with voice memos)
    const { data: rec } = await supabase.from("nudges").select("*").eq("to_user", me).eq("date", todayStr());
    setMyNudges(rec || []);
    const aurls = {};
    for (const n of rec || []) {
      if (n.audio_path) {
        const { data } = await supabase.storage.from("checkins").createSignedUrl(n.audio_path, 3600);
        if (data?.signedUrl) aurls[n.audio_path] = data.signedUrl;
      }
    }
    setAudioUrls(aurls);
  }

  useEffect(() => { if (user) refresh(); }, [user]); // eslint-disable-line

  const profileMap = useMemo(() => {
    const m = Object.fromEntries(friends.map((f) => [f.id, f]));
    if (profile) m[profile.id] = profile;
    return m;
  }, [friends, profile]);

  // group events by user+date; fixed display order inside a card so late logs
  // don't jump above the photos (photos stay the hero of the post)
  const EVENT_ORDER = { photos: 0, checkin: 1, lift: 2, food: 3, habits: 4, tasks: 5, journal_done: 6 };
  const groups = useMemo(() => {
    const g = {};
    for (const e of events) {
      const k = `${e.date}|${e.user_id}`;
      (g[k] = g[k] || []).push(e);
    }
    for (const k in g) g[k].sort((a, b) => (EVENT_ORDER[a.type] ?? 9) - (EVENT_ORDER[b.type] ?? 9));
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [events]); // eslint-disable-line

  // leaderboard: weekly avg score + streak of days with any event
  const board = useMemo(() => {
    const byUser = {};
    for (const e of events) ((byUser[e.user_id] = byUser[e.user_id] || {})[e.date] = byUser[e.user_id][e.date] || []).push(e);
    return Object.values(profileMap).map((p) => {
      const days = byUser[p.id] || {};
      const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), -i));
      const scores = last7.map((d) => (days[d] ? dayScore(days[d]) : 0));
      let streak = 0, d = todayStr();
      if (!days[d]) d = addDays(d, -1);
      while (days[d]) { streak++; d = addDays(d, -1); }
      return { ...p, weekly: Math.round(scores.reduce((a, b) => a + b, 0) / 7), streak };
    }).sort((a, b) => b.weekly - a.weekly);
  }, [events, profileMap]);

  if (loading) return null;

  const today = todayStr();
  const isCheckinDay = profile && new Date().getDay() === profile.checkin_day;
  const checkedInThisWeek = events.some((e) => e.user_id === user.id && e.type === "checkin" && e.date >= addDays(today, -6));

  function onNudgeSent(fid) {
    setNudgedToday(new Set([...nudgedToday, fid]));
  }

  // One reaction per user per post: tap same = remove, tap different = switch
  async function react(groupEvents, emoji) {
    const evIds = groupEvents.map((e) => e.id);
    const mine = reactions.find((r) => evIds.includes(r.event_id) && r.user_id === user.id && r.emoji);
    if (mine) {
      await supabase.from("reactions").delete().eq("id", mine.id);
      if (mine.emoji === emoji) { refresh(); return; }
    }
    await supabase.from("reactions").insert({ event_id: groupEvents[0].id, user_id: user.id, emoji });
    refresh();
  }

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Social</h1>
        <div className="flex gap-2">
          <button className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-card" onClick={() => setCompareOpen(true)}>📸</button>
          <button className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-card" onClick={() => setFriendsOpen(true)}>
            Friends{pendingIn.length > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{pendingIn.length}</span>}
          </button>
        </div>
      </div>

      {isCheckinDay && !checkedInThisWeek && (
        <button className="btn-primary mb-3 w-full" onClick={() => setCheckinOpen(true)}>
          📸 It's check-in day — post your weekly check-in
        </button>
      )}

      {/* Nudges received today */}
      {myNudges.length > 0 && (
        <div className="card mb-3 bg-amber-50">
          <h3 className="mb-1.5 font-bold">👀 You got nudged</h3>
          <div className="space-y-2">
            {myNudges.map((n) => (
              <div key={n.from_user}>
                <p className="text-sm">
                  <b>{profileMap[n.from_user]?.display_name || "A friend"}</b> says lock in
                  {n.message && <span className="italic text-gray-600"> — "{n.message}"</span>}
                </p>
                {n.audio_path && audioUrls[n.audio_path] && (
                  <audio controls preload="metadata" src={audioUrls[n.audio_path]} className="mt-1 h-9 w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card mb-3">
        <h3 className="font-bold">Locked-In board · this week</h3>
        <p className="mb-2 mt-0.5 text-[11px] leading-snug text-gray-400">
          Each day scores 0–100 for showing up: food logged, trained (or rest logged), habits, tasks, journal.
        </p>
        <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <span className="w-5" />
          <span className="flex-1">Friend</span>
          <span title="Consecutive days with activity">Streak</span>
          <span className="w-12 text-right" title="Average daily score over the last 7 days">Wk avg</span>
          <span className="w-6 text-center" title="Letter grade for the weekly average">Grade</span>
        </div>
        <div className="space-y-1.5">
          {board.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center font-bold text-gray-400">{i + 1}</span>
              <span className="flex-1 font-semibold">{p.display_name}{p.id === user.id && " (you)"}</span>
              <span className="text-[11px] text-gray-500">🔥 {p.streak}</span>
              <span className="w-12 text-right font-bold text-lock">{p.weekly}</span>
              <span className="w-6 text-center text-xs font-bold text-gray-400">{gradeFor(p.weekly)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nudges */}
      {friends.filter((f) => !events.some((e) => e.user_id === f.id && e.date === today)).map((f) => (
        <div key={f.id} className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
          <span className="text-sm">👀 <b>{f.display_name}</b> hasn't logged anything today</span>
          <button className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
            disabled={nudgedToday.has(f.id)} onClick={() => setNudgeFor(f)}>
            {nudgedToday.has(f.id) ? "Nudged ✓" : "Lock in 👀"}
          </button>
        </div>
      ))}

      {/* Feed */}
      {!friends.length && (
        <div className="card text-center text-sm text-gray-500">
          No friends yet. Add friends by username — your invite handle is <b>@{profile?.username}</b>.
        </div>
      )}
      <div className="space-y-3">
        {groups.map(([key, evs]) => {
          const [date, uid] = key.split("|");
          const p = profileMap[uid];
          if (!p) return null;
          const score = dayScore(evs);
          const evIds = evs.map((e) => e.id);
          const myRx = reactions.filter((r) => evIds.includes(r.event_id));
          const myEmoji = myRx.find((r) => r.user_id === user.id && r.emoji)?.emoji;
          return (
            <div key={key} className="card">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold">
                  {p.display_name}{uid === user.id && " (you)"}
                  {uid === user.id && (
                    <button aria-label="Add or edit photos"
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 active:scale-95"
                      onClick={() => setEditorDate(date)}>
                      📸 {evs.some((e) => e.type === "photos") ? "edit" : "add"}
                    </button>
                  )}
                </span>
                <span className="text-[11px] text-gray-400">
                  {date === today ? "Today" : new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  <b className="ml-2 text-lock">{gradeFor(score)}</b>
                </span>
              </div>
              <div className="space-y-1 text-sm">
                {evs.map((e) => <EventLine key={e.id} e={e} p={p} photoUrls={photoUrls} />)}
              </div>
              <div className="mt-2 flex items-center gap-1 border-t border-gray-50 pt-2">
                {EMOJIS.map((em) => {
                  const count = myRx.filter((r) => r.emoji === em).length;
                  const mine = myEmoji === em;
                  return (
                    <button key={em} onClick={() => react(evs, em)}
                      className={`rounded-full px-2.5 py-1 text-sm transition active:scale-90 ${mine ? "bg-lock-faint ring-2 ring-lock-light" : "bg-gray-50"}`}>
                      {em}{count > 0 && <span className={`ml-1 text-[10px] font-bold ${mine ? "text-lock" : "text-gray-500"}`}>{count}</span>}
                    </button>
                  );
                })}
                <CommentBox onSend={(text) => supabase.from("reactions")
                  .insert({ event_id: evs[0].id, user_id: user.id, comment: text }).then(refresh)} />
              </div>
              {myRx.filter((r) => r.comment).map((r) => (
                <p key={r.id} className="mt-1 text-[12px] text-gray-500">
                  <b>{profileMap[r.user_id]?.display_name || "Friend"}:</b> {r.comment}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      <FriendsSheet open={friendsOpen} onClose={() => setFriendsOpen(false)} me={user?.id}
        friends={friends} pendingIn={pendingIn} onChanged={refresh} myUsername={profile?.username} />
      <CheckinSheet open={checkinOpen} onClose={() => setCheckinOpen(false)} user={user} profile={profile} onPosted={refresh} />
      <CompareSheet open={compareOpen} onClose={() => setCompareOpen(false)} uid={user?.id}
        onNew={() => { setCompareOpen(false); setCheckinOpen(true); }} />
      <PostEditorSheet open={!!editorDate} onClose={() => setEditorDate(null)} user={user} date={editorDate}
        existing={events.find((e) => e.user_id === user?.id && e.date === editorDate && e.type === "photos") || null}
        photoUrls={photoUrls} onSaved={refresh} />
      <NudgeSheet open={!!nudgeFor} onClose={() => setNudgeFor(null)} me={user?.id} friend={nudgeFor} onSent={onNudgeSent} />
    </div>
  );
}

function EventLine({ e, p, photoUrls }) {
  const s = e.summary || {};
  // Nothing completed → nothing shown (also enforced at write time in lib/store.js)
  if (e.type === "food" && !s.meals) return null;
  if (e.type === "habits" && !s.done) return null;
  if (e.type === "tasks" && !s.done) return null;
  if (e.type === "food")
    return <p>🍽 Logged {s.meals} meal{s.meals !== 1 && "s"} — {s.proteinHit ? "hit protein ✓" : `${s.protein}/${s.proteinTarget}g protein`}, {s.kcal}/{s.kcalTarget} kcal</p>;
  if (e.type === "lift")
    return (
      <div>
        <p>🏋️ Trained <b>{s.type}</b>{s.sets > 0 && ` — ${s.sets} sets`}</p>
        {s.note && <p className="mt-0.5 rounded-lg bg-gray-50 px-2 py-1 text-[12px] italic text-gray-600">"{s.note}"</p>}
      </div>
    );
  if (e.type === "photos") {
    const items = (s.items || []).filter((it) => it.path && photoUrls[it.path]);
    if (!items.length) return null;
    return (
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.path || i}>
            <img src={photoUrls[it.path]} alt="update" className="max-h-72 w-full rounded-xl object-cover" />
            <div className="mt-0.5 flex items-baseline justify-between">
              {it.caption ? <p className="text-[12px] italic text-gray-600">"{it.caption}"</p> : <span />}
              {it.at && (
                <span className="shrink-0 text-[10px] text-gray-400">
                  {new Date(it.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (e.type === "habits") return <p>✅ Completed {s.done}/{s.total} habits</p>;
  if (e.type === "tasks") return <p>📋 Cleared {s.done}/{s.total} tasks</p>;
  if (e.type === "journal_done") return <p>📓 Journaled ✓</p>;
  if (e.type === "checkin") {
    const delta = s.weight && p.start_weight && p.goal_weight
      ? `${Math.abs(p.start_weight - s.weight).toFixed(1)} lb ${p.start_weight > p.goal_weight ? "down" : "up"} toward ${p.goal_weight}`
      : null;
    return (
      <div>
        <p>🎯 Checked in: <b>{s.weight} lb</b>{delta && ` — ${delta}`}</p>
        {s.caption && <p className="text-[12px] italic text-gray-600">"{s.caption}"</p>}
        {s.photo_path && photoUrls[s.photo_path] && (
          <img src={photoUrls[s.photo_path]} alt="check-in" className="mt-1.5 max-h-72 w-full rounded-xl object-cover" />
        )}
      </div>
    );
  }
  return null;
}

function CommentBox({ onSend }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    showToast("Comment posted ✓");
  }
  return (
    <form onSubmit={submit}
      className={`ml-1 flex min-w-0 flex-1 items-center gap-1 rounded-full border px-1.5 py-0.5 transition ${
        focused ? "border-lock-light bg-white shadow-sm" : "border-transparent bg-gray-50"}`}>
      <input
        className="min-w-0 flex-1 bg-transparent px-1.5 py-1 text-xs outline-none placeholder:text-gray-400"
        placeholder="Add a comment…" value={text}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChange={(e) => setText(e.target.value)} />
      {(focused || text) && (
        <button type="submit" disabled={!text.trim()}
          className="shrink-0 rounded-full bg-lock px-2.5 py-1 text-[11px] font-bold text-white transition active:scale-90 disabled:opacity-30">
          Send
        </button>
      )}
    </form>
  );
}

function FriendsSheet({ open, onClose, me, friends, pendingIn, onChanged, myUsername }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState("");

  async function search() {
    const { data } = await supabase.from("profiles")
      .select("id, username, display_name").ilike("username", `%${q.toLowerCase()}%`).neq("id", me).limit(10);
    setResults(data || []);
  }

  async function sendRequest(other) {
    const [a, b] = [me, other].sort();
    const { error } = await supabase.from("friendships")
      .insert({ user_a: a, user_b: b, requested_by: me });
    setMsg(error ? (error.message.includes("duplicate") ? "Already requested/friends." : error.message) : "Request sent ✓");
    onChanged();
  }

  async function accept(r) {
    await supabase.from("friendships").update({ status: "accepted" })
      .eq("user_a", r.user_a).eq("user_b", r.user_b);
    onChanged();
  }

  async function remove(fid) {
    const [a, b] = [me, fid].sort();
    await supabase.from("friendships").delete().eq("user_a", a).eq("user_b", b);
    onChanged();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Friends">
      <p className="mb-3 rounded-xl bg-lock-faint px-3 py-2 text-[12px] text-lock">
        Your handle: <b>@{myUsername}</b> — share it so friends can add you.
      </p>
      <form className="mb-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input className="input flex-1" placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>
      {msg && <p className="mb-2 text-sm text-lock">{msg}</p>}
      {results.map((r) => (
        <div key={r.id} className="mb-1 flex items-center justify-between rounded-xl bg-gray-50 p-3">
          <span className="text-sm"><b>{r.display_name}</b> <span className="text-gray-400">@{r.username}</span></span>
          <button className="rounded-full bg-lock px-3 py-1 text-xs font-bold text-white" onClick={() => sendRequest(r.id)}>Add</button>
        </div>
      ))}
      {pendingIn.length > 0 && <h3 className="mb-1 mt-4 font-bold">Requests</h3>}
      {pendingIn.map((r) => (
        <div key={r.user_a + r.user_b} className="mb-1 flex items-center justify-between rounded-xl bg-amber-50 p-3">
          <span className="text-sm"><b>{r.profile?.display_name}</b> <span className="text-gray-400">@{r.profile?.username}</span></span>
          <button className="rounded-full bg-lock px-3 py-1 text-xs font-bold text-white" onClick={() => accept(r)}>Accept</button>
        </div>
      ))}
      <h3 className="mb-1 mt-4 font-bold">Your friends ({friends.length})</h3>
      {friends.map((f) => (
        <div key={f.id} className="mb-1 flex items-center justify-between rounded-xl bg-gray-50 p-3">
          <span className="text-sm"><b>{f.display_name}</b> <span className="text-gray-400">@{f.username}</span>
            {f.goal_text && <span className="ml-1 text-[11px] text-lock">· {f.goal_text}</span>}</span>
          <button className="text-xs text-red-400" onClick={() => remove(f.id)}>Remove</button>
        </div>
      ))}
    </Sheet>
  );
}

function CheckinSheet({ open, onClose, user, profile, onPosted }) {
  const [file, setFile] = useState(null);
  const [weight, setWeight] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post() {
    setBusy(true); setError("");
    try {
      const date = todayStr();
      let photo_path = null;
      if (file) {
        photo_path = `${user.id}/${date}-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("checkins").upload(photo_path, file, { upsert: true });
        if (upErr) throw upErr;
      }
      await supabase.from("checkins").insert({ user_id: user.id, date, photo_path, weight: weight ? +weight : null, caption });
      await supabase.from("feed_events").upsert(
        { user_id: user.id, date, type: "checkin", summary: { weight: weight ? +weight : null, caption, photo_path } },
        { onConflict: "user_id,date,type" });
      showToast("Check-in posted ✓");
      onPosted();
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title="📸 Weekly check-in">
      <div className="space-y-3">
        <input type="file" accept="image/*" className="input"
          onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <input className="input" type="number" inputMode="decimal" placeholder={`Current weight (${profile?.unit_pref || "lb"})`}
          value={weight} onChange={(e) => setWeight(e.target.value)} />
        <input className="input" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-[11px] text-gray-400">Visible to friends only.</p>
        <button className="btn-primary w-full" disabled={busy || (!file && !weight)} onClick={post}>
          {busy ? "Posting…" : "Post check-in"}
        </button>
      </div>
    </Sheet>
  );
}

function CompareSheet({ open, onClose, uid, onNew }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!open || !uid) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("checkins").select("*").eq("user_id", uid).order("date", { ascending: false });
      const rows = data || [];
      const out = [];
      for (const r of rows) {
        let url = null;
        if (r.photo_path) {
          const { data: s } = await supabase.storage.from("checkins").createSignedUrl(r.photo_path, 3600);
          url = s?.signedUrl;
        }
        out.push({ ...r, url });
      }
      setItems(out);
      setLoading(false);
    })();
  }, [open, uid]);

  const first = items.at(-1);
  const latest = items[0];
  const delta = first && latest && first.weight && latest.weight && first.id !== latest.id
    ? Math.round((latest.weight - first.weight) * 10) / 10 : null;

  return (
    <Sheet open={open} onClose={onClose} title="📸 Progress check-ins">
      <button className="btn-primary mb-3 w-full" onClick={onNew}>+ New check-in</button>
      {delta !== null && (
        <p className="mb-3 rounded-xl bg-lock-faint px-3 py-2 text-center text-sm font-semibold text-lock">
          {first.weight} lb → {latest.weight} lb ({delta > 0 ? "+" : ""}{delta} lb since {first.date})
        </p>
      )}
      {loading && <p className="py-4 text-center text-sm text-gray-400">Loading…</p>}
      {!loading && !items.length && (
        <p className="py-4 text-center text-sm text-gray-400">
          No check-ins yet — post your first one and watch the side-by-side grow week over week.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {items.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-xl bg-gray-50">
            {c.url && <img src={c.url} alt="" className="aspect-[3/4] w-full object-cover" />}
            <div className="p-2 text-[11px]">
              <b>{c.weight ? `${c.weight} lb` : "—"}</b> · {c.date}
              {c.caption && <div className="truncate italic text-gray-400">"{c.caption}"</div>}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

const MAX_MEMO_SECS = 15;

// Nudge a friend with an optional voice memo + text roast.
function NudgeSheet({ open, onClose, me, friend, onSent }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);

  useEffect(() => {
    if (open) { setBlob(null); setPreview(null); setMessage(""); setError(""); setSecs(0); setRecording(false); }
    return () => { try { recRef.current?.stop(); } catch {} };
  }, [open]);

  // recording timer + auto-stop cap
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSecs((s) => {
      if (s + 1 >= MAX_MEMO_SECS) stopRec();
      return s + 1;
    }), 1000);
    return () => clearInterval(t);
  }, [recording]); // eslint-disable-line

  if (!open || !friend) return null;

  async function startRec() {
    setError(""); setBlob(null); setPreview(null); setSecs(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm" : "audio/mp4";
      const r = new MediaRecorder(stream, { mimeType: mime });
      const chunks = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        const b = new Blob(chunks, { type: mime });
        setBlob(b);
        setPreview(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      r.start();
      recRef.current = r;
      setRecording(true);
    } catch {
      setError("Couldn't access the mic — check permissions.");
    }
  }

  function stopRec() {
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
  }

  async function send() {
    setBusy(true); setError("");
    try {
      const date = todayStr();
      let audio_path = null;
      if (blob) {
        const ext = blob.type.includes("mp4") ? "m4a" : "webm";
        audio_path = `${me}/nudges/${date}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("checkins")
          .upload(audio_path, blob, { upsert: true, contentType: blob.type });
        if (upErr) throw upErr;
      }
      const { error: insErr } = await supabase.from("nudges")
        .insert({ from_user: me, to_user: friend.id, date, audio_path, message: message.trim() || null });
      if (insErr) throw insErr;
      showToast("Nudge sent 👀");
      onSent(friend.id);
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title={`👀 Nudge ${friend.display_name}`}>
      <div className="space-y-3">
        <p className="text-[12px] text-gray-400">
          They haven't logged anything today. Say it to their face — 15 seconds max.
        </p>

        {!recording && !blob && (
          <button className="btn-primary w-full" onClick={startRec}>🎙 Record voice memo</button>
        )}
        {recording && (
          <button className="w-full animate-pulse rounded-2xl bg-red-500 py-3 font-bold text-white active:scale-95"
            onClick={stopRec}>
            ⏹ Recording… {secs}s / {MAX_MEMO_SECS}s — tap to stop
          </button>
        )}
        {blob && preview && (
          <div className="rounded-xl bg-gray-50 p-2.5">
            <audio controls src={preview} className="h-9 w-full" />
            <button className="mt-1 text-xs font-semibold text-red-400"
              onClick={() => { setBlob(null); setPreview(null); }}>
              Re-record
            </button>
          </div>
        )}

        <input className="input" placeholder="Or type a message (optional)"
          value={message} onChange={(e) => setMessage(e.target.value)} maxLength={120} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || recording} onClick={send}>
          {busy ? "Sending…" : blob || message.trim() ? "Send nudge 👀" : "Send plain nudge 👀"}
        </button>
      </div>
    </Sheet>
  );
}

// Add / edit photo updates on your own post — "live updates" through the day.
// Stored as one feed_event of type "photos" per day: summary.items = [{ path, caption, at }]
function PostEditorSheet({ open, onClose, user, date, existing, photoUrls, onSaved }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setItems((existing?.summary?.items || []).map((x) => ({ ...x })));
  }, [open, existing]);

  if (!open) return null;

  async function addPhotos(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusy(true); setError("");
    try {
      for (const [i, file] of list.entries()) {
        const path = `${user.id}/updates/${date}-${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage.from("checkins").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        setItems((p) => [...p, { path, caption: "", at: new Date().toISOString(), preview: URL.createObjectURL(file) }]);
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function save() {
    setBusy(true); setError("");
    try {
      // clean out photos removed during editing
      const kept = new Set(items.map((it) => it.path));
      const removed = (existing?.summary?.items || []).map((it) => it.path).filter((p) => p && !kept.has(p));
      if (removed.length) await supabase.storage.from("checkins").remove(removed);

      const clean = items.map(({ preview, ...it }) => it);
      if (clean.length) {
        await supabase.from("feed_events").upsert(
          { user_id: user.id, date, type: "photos", summary: { items: clean } },
          { onConflict: "user_id,date,type" });
      } else if (existing) {
        await supabase.from("feed_events").delete()
          .eq("user_id", user.id).eq("date", date).eq("type", "photos");
      }
      showToast("Post updated ✓");
      onSaved(); onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title="📸 Photo updates">
      <p className="mb-3 text-[11px] text-gray-400">
        Add photos to today's post as the day unfolds — meals, pumps, PRs. Friends see them live in the feed.
      </p>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={it.path || i} className="rounded-xl bg-gray-50 p-2">
            <img src={photoUrls[it.path] || it.preview} alt="" className="max-h-56 w-full rounded-lg object-cover" />
            <div className="mt-1.5 flex items-center gap-2">
              <input className="input flex-1 py-1.5 text-sm" placeholder="Caption (optional)"
                value={it.caption || ""}
                onChange={(e) => setItems((p) => p.map((x, xi) => (xi === i ? { ...x, caption: e.target.value } : x)))} />
              <button className="shrink-0 text-xs font-semibold text-red-400 active:scale-95"
                onClick={() => setItems((p) => p.filter((_, xi) => xi !== i))}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <label className={`btn-ghost block w-full cursor-pointer text-center ${busy ? "opacity-50" : ""}`}>
          {busy ? "Uploading…" : "+ Add photos"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy}
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy} onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}