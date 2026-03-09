export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
        };
        Update: {
          username?: string;
          display_name?: string | null;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          white_player_id: string | null;
          black_player_id: string | null;
          board_state: unknown;
          current_player: string;
          dice: unknown;
          remaining_dice: unknown;
          status: string;
          winner: string | null;
          win_type: string | null;
          last_move_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          white_player_id?: string | null;
          black_player_id?: string | null;
          board_state: unknown;
          current_player?: string;
          dice?: unknown;
          remaining_dice?: unknown;
          status?: string;
          winner?: string | null;
          win_type?: string | null;
        };
        Update: {
          board_state?: unknown;
          current_player?: string;
          dice?: unknown;
          remaining_dice?: unknown;
          status?: string;
          winner?: string | null;
          win_type?: string | null;
          last_move_at?: string;
        };
        Relationships: [];
      };
      moves: {
        Row: {
          game_id: string;
          move_number: number;
          player: string;
          dice: unknown;
          moves_data: unknown;
          board_after: unknown;
          created_at: string;
        };
        Insert: {
          game_id: string;
          move_number: number;
          player: string;
          dice: unknown;
          moves_data: unknown;
          board_after: unknown;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      friendships: {
        Row: {
          user_a: string;
          user_b: string;
          status: string;
          requested_by: string;
          created_at: string;
        };
        Insert: {
          user_a: string;
          user_b: string;
          status?: string;
          requested_by: string;
        };
        Update: {
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
