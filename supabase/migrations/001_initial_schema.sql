-- ============================================
-- Backgammon PWA — Initial Database Schema
-- ============================================
-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- 1. Profiles
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- 2. Games
create table public.games (
  id uuid default gen_random_uuid() primary key,
  white_player_id uuid references public.profiles(id),
  black_player_id uuid references public.profiles(id),
  board_state jsonb not null,
  current_player text not null default 'white',
  dice jsonb,
  remaining_dice jsonb,
  status text not null default 'rolling',
  winner text,
  win_type text,
  last_move_at timestamptz default now(),
  created_at timestamptz default now() not null
);

alter table public.games enable row level security;

create policy "Players can view own games"
  on public.games for select
  using (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "Authenticated users can create games"
  on public.games for insert
  with check (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "Players can update own games"
  on public.games for update
  using (auth.uid() = white_player_id or auth.uid() = black_player_id);

-- 3. Moves (game history)
create table public.moves (
  game_id uuid references public.games(id) on delete cascade not null,
  move_number integer not null,
  player text not null,
  dice jsonb not null,
  moves_data jsonb not null,
  board_after jsonb not null,
  created_at timestamptz default now() not null,
  primary key (game_id, move_number)
);

alter table public.moves enable row level security;

create policy "Players can view moves of own games"
  on public.moves for select
  using (exists (
    select 1 from public.games g
    where g.id = game_id
      and (auth.uid() = g.white_player_id or auth.uid() = g.black_player_id)
  ));

create policy "Players can insert moves"
  on public.moves for insert
  with check (exists (
    select 1 from public.games g
    where g.id = game_id
      and (auth.uid() = g.white_player_id or auth.uid() = g.black_player_id)
  ));

-- 4. Friendships
create table public.friendships (
  user_a uuid references public.profiles(id) not null,
  user_b uuid references public.profiles(id) not null,
  status text not null default 'pending',
  requested_by uuid references public.profiles(id) not null,
  created_at timestamptz default now() not null,
  primary key (user_a, user_b),
  constraint ordered_pair check (user_a < user_b)
);

alter table public.friendships enable row level security;

create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Users can create friendships"
  on public.friendships for insert
  with check (auth.uid() = requested_by and (auth.uid() = user_a or auth.uid() = user_b));

create policy "Users can update own friendships"
  on public.friendships for update
  using (auth.uid() = user_a or auth.uid() = user_b);

-- 5. Enable Realtime for games table (for Phase 3)
alter publication supabase_realtime add table public.games;
