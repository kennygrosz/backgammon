import { supabase } from './supabase';
import type { BoardState, DiceRoll, Player, WinType } from '../engine/types';
import { createInitialBoard } from '../engine/board';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---------- Types ----------

export interface DbGame {
  id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  board_state: BoardState;
  current_player: Player;
  dice: DiceRoll | null;
  remaining_dice: number[];
  status: string;
  winner: Player | null;
  win_type: WinType | null;
  last_move_at: string;
  created_at: string;
  // joined from profiles
  white_profile?: { username: string } | null;
  black_profile?: { username: string } | null;
}

// ---------- Queries ----------

export async function createGame(userId: string): Promise<DbGame | null> {
  const board = createInitialBoard();
  const { data, error } = await supabase
    .from('games')
    .insert({
      white_player_id: userId,
      board_state: board as unknown,
      current_player: 'white',
      status: 'waiting', // waiting for opponent
    })
    .select()
    .single();

  if (error) {
    console.error('createGame error:', error);
    return null;
  }
  return data as unknown as DbGame;
}

export async function joinGame(gameId: string, userId: string): Promise<DbGame | null> {
  const { data, error } = await supabase
    .from('games')
    .update({
      black_player_id: userId,
      status: 'rolling',
    })
    .eq('id', gameId)
    .is('black_player_id', null)
    .select()
    .single();

  if (error) {
    console.error('joinGame error:', error);
    return null;
  }
  return data as unknown as DbGame;
}

export async function fetchGame(gameId: string): Promise<DbGame | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*, white_profile:profiles!white_player_id(username), black_profile:profiles!black_player_id(username)')
    .eq('id', gameId)
    .single();

  if (error) {
    console.error('fetchGame error:', error);
    return null;
  }
  return data as unknown as DbGame;
}

export async function fetchMyGames(userId: string): Promise<DbGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*, white_profile:profiles!white_player_id(username), black_profile:profiles!black_player_id(username)')
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
    .order('last_move_at', { ascending: false });

  if (error) {
    console.error('fetchMyGames error:', error);
    return [];
  }
  return (data ?? []) as unknown as DbGame[];
}

export async function fetchOpenGames(userId: string): Promise<DbGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*, white_profile:profiles!white_player_id(username)')
    .eq('status', 'waiting')
    .neq('white_player_id', userId)
    .is('black_player_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchOpenGames error:', error);
    return [];
  }
  return (data ?? []) as unknown as DbGame[];
}

export async function updateGameState(
  gameId: string,
  updates: {
    board_state: BoardState;
    current_player: Player;
    dice: DiceRoll | null;
    remaining_dice: number[];
    status: string;
    winner?: Player | null;
    win_type?: WinType | null;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('games')
    .update({
      ...updates,
      board_state: updates.board_state as unknown,
      dice: updates.dice as unknown,
      remaining_dice: updates.remaining_dice as unknown,
      last_move_at: new Date().toISOString(),
    })
    .eq('id', gameId);

  if (error) {
    console.error('updateGameState error:', error);
    return false;
  }
  return true;
}

// ---------- Realtime ----------

export function subscribeToGame(
  gameId: string,
  onUpdate: (game: DbGame) => void
): RealtimeChannel {
  return supabase
    .channel(`game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        onUpdate(payload.new as unknown as DbGame);
      }
    )
    .subscribe();
}

export function unsubscribeFromGame(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
