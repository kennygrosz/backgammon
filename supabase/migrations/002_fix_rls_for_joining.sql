-- Fix RLS policies so users can view and join open games
-- Run this in Supabase SQL Editor

-- Drop old select policy
drop policy if exists "Players can view own games" on public.games;

-- New select: players can see own games, AND anyone authenticated can see 'waiting' games
create policy "Players can view own games or open games"
  on public.games for select
  using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
    or (status = 'waiting' and black_player_id is null)
  );

-- Drop old update policy
drop policy if exists "Players can update own games" on public.games;

-- New update: players can update own games, AND authenticated users can join waiting games
create policy "Players can update own games or join"
  on public.games for update
  using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
    or (status = 'waiting' and black_player_id is null)
  );
