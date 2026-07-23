-- LockedIn schema — run once in the Supabase SQL editor.
-- Privacy is enforced here (RLS), not just in the UI.

create extension if not exists pgcrypto;

-- ============ TABLES ============

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  avatar_url text,
  goal_text text,                 -- "Cut to 180"
  goal_type text,                 -- cut | bulk | maintain
  goal_weight numeric,
  start_weight numeric,
  unit_pref text default 'lb',
  checkin_day int default 0,      -- 0=Sun .. 6=Sat
  targets jsonb default '{
    "train": {"kcal": 2200, "p": 215, "c": 210, "f": 55},
    "rest":  {"kcal": 1800, "p": 215, "c": 100, "f": 55}
  }'::jsonb,
  created_at timestamptz default now()
);

create table if not exists friendships (
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  requested_by uuid not null,
  created_at timestamptz default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- Per-day document, same pattern as cos_v6.
create table if not exists days (
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  meals jsonb default '[]'::jsonb,
  water int default 0,
  habits jsonb default '{}'::jsonb,
  lift jsonb,
  tasks jsonb default '[]'::jsonb,
  blocks jsonb default '[]'::jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

-- Strictest table: never visible to anyone but the owner.
create table if not exists journal (
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  am jsonb,
  pm jsonb,
  mood text,
  weight numeric,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  photo_path text,
  weight numeric,
  caption text,
  created_at timestamptz default now()
);

-- ONLY summary fields are ever written here (computed in lib/store.js).
create table if not exists feed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  type text not null check (type in ('food','lift','habits','tasks','journal_done','checkin')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, date, type)
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references feed_events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text,
  comment text,
  created_at timestamptz default now()
);

create table if not exists nudges (
  from_user uuid not null references profiles(id) on delete cascade,
  to_user uuid not null references profiles(id) on delete cascade,
  date date not null,
  created_at timestamptz default now(),
  primary key (from_user, to_user, date)   -- max 1/day per friend
);

-- ============ HELPERS ============

create or replace function are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

-- ============ RLS ============

alter table profiles    enable row level security;
alter table friendships enable row level security;
alter table days        enable row level security;
alter table journal     enable row level security;
alter table checkins    enable row level security;
alter table feed_events enable row level security;
alter table reactions   enable row level security;
alter table nudges      enable row level security;

-- profiles: own full access; anyone authed can read basics (needed for username search)
create policy "profiles own"    on profiles for all    using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles search" on profiles for select using (auth.role() = 'authenticated');

-- friendships: involved users only
create policy "friendships read"   on friendships for select using (auth.uid() in (user_a, user_b));
create policy "friendships insert" on friendships for insert with check (auth.uid() = requested_by and auth.uid() in (user_a, user_b));
create policy "friendships update" on friendships for update using (auth.uid() in (user_a, user_b) and auth.uid() <> requested_by);
create policy "friendships delete" on friendships for delete using (auth.uid() in (user_a, user_b));

-- days + journal: owner only, always. Friends never see these rows.
create policy "days own"    on days    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal own" on journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- checkins: owner writes, friends read (explicit weekly post)
create policy "checkins own"     on checkins for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "checkins friends" on checkins for select using (are_friends(auth.uid(), user_id));

-- feed_events: owner writes, friends read
create policy "feed own"     on feed_events for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feed friends" on feed_events for select using (are_friends(auth.uid(), user_id));

-- reactions: visible to whoever can see the event; write your own
create policy "reactions read" on reactions for select using (
  exists (select 1 from feed_events e where e.id = event_id
          and (e.user_id = auth.uid() or are_friends(auth.uid(), e.user_id)))
);
create policy "reactions write" on reactions for insert with check (
  auth.uid() = user_id and
  exists (select 1 from feed_events e where e.id = event_id
          and (e.user_id = auth.uid() or are_friends(auth.uid(), e.user_id)))
);
create policy "reactions delete" on reactions for delete using (auth.uid() = user_id);

-- nudges: send to friends only; sender + recipient can read
create policy "nudges read"   on nudges for select using (auth.uid() in (from_user, to_user));
create policy "nudges insert" on nudges for insert with check (auth.uid() = from_user and are_friends(from_user, to_user));

-- ============ STORAGE ============
-- Check-in photos live in bucket "checkins" under <user_id>/<filename>.

insert into storage.buckets (id, name, public) values ('checkins', 'checkins', false)
on conflict (id) do nothing;

create policy "checkin photos own" on storage.objects for all
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "checkin photos friends" on storage.objects for select
  using (bucket_id = 'checkins' and are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid));
