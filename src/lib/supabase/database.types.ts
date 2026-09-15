// Generated from Supabase project rhvbgcgjfnhvgubnnfzs (MCP generate_typescript_types).
// スキーマ変更後は再生成すること。
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          attributes: Json
          created_at: string
          created_by: string | null
          element: string | null
          family_key: string
          form: string | null
          id: number
          monster_no: number | null
          name: string
          name_kana: string | null
          rarity: number | null
          series: string | null
          source: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          created_by?: string | null
          element?: string | null
          family_key: string
          form?: string | null
          id?: number
          monster_no?: number | null
          name: string
          name_kana?: string | null
          rarity?: number | null
          series?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          created_by?: string | null
          element?: string | null
          family_key?: string
          form?: string | null
          id?: number
          monster_no?: number | null
          name?: string
          name_kana?: string | null
          rarity?: number | null
          series?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipped_fruits: {
        Row: {
          attached_at: string | null
          created_at: string
          fruit_rank_id: number
          fruit_type_id: number
          id: string
          owned_monster_id: string
          slot_no: number
          updated_at: string
        }
        Insert: {
          attached_at?: string | null
          created_at?: string
          fruit_rank_id: number
          fruit_type_id: number
          id?: string
          owned_monster_id: string
          slot_no: number
          updated_at?: string
        }
        Update: {
          attached_at?: string | null
          created_at?: string
          fruit_rank_id?: number
          fruit_type_id?: number
          id?: string
          owned_monster_id?: string
          slot_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipped_fruits_fruit_rank_id_fkey"
            columns: ["fruit_rank_id"]
            isOneToOne: false
            referencedRelation: "fruit_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipped_fruits_fruit_type_id_fkey"
            columns: ["fruit_type_id"]
            isOneToOne: false
            referencedRelation: "fruit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipped_fruits_owned_monster_id_fkey"
            columns: ["owned_monster_id"]
            isOneToOne: false
            referencedRelation: "owned_monsters"
            referencedColumns: ["id"]
          },
        ]
      }
      fruit_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owned_monster_id: string | null
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owned_monster_id?: string | null
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owned_monster_id?: string | null
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fruit_events_owned_monster_id_fkey"
            columns: ["owned_monster_id"]
            isOneToOne: false
            referencedRelation: "owned_monsters"
            referencedColumns: ["id"]
          },
        ]
      }
      fruit_ranks: {
        Row: {
          code: string
          id: number
          label: string
          rank_value: number
        }
        Insert: {
          code: string
          id?: number
          label: string
          rank_value: number
        }
        Update: {
          code?: string
          id?: number
          label?: string
          rank_value?: number
        }
        Relationships: []
      }
      fruit_types: {
        Row: {
          attributes: Json
          category: string
          code: string
          default_duplicate_policy: string
          effect_scope: string
          id: number
          is_active: boolean
          name: string
          short_name: string
          sort_order: number
          stacks_in_party: boolean
        }
        Insert: {
          attributes?: Json
          category: string
          code: string
          default_duplicate_policy?: string
          effect_scope: string
          id?: number
          is_active?: boolean
          name: string
          short_name: string
          sort_order: number
          stacks_in_party?: boolean
        }
        Update: {
          attributes?: Json
          category?: string
          code?: string
          default_duplicate_policy?: string
          effect_scope?: string
          id?: number
          is_active?: boolean
          name?: string
          short_name?: string
          sort_order?: number
          stacks_in_party?: boolean
        }
        Relationships: []
      }
      owned_monsters: {
        Row: {
          character_id: number
          copy_label: string
          created_at: string
          hero_seal_slots: number
          id: string
          is_archived: boolean
          luck: number | null
          memo: string | null
          role_tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: number
          copy_label?: string
          created_at?: string
          hero_seal_slots?: number
          id?: string
          is_archived?: boolean
          luck?: number | null
          memo?: string | null
          role_tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: number
          copy_label?: string
          created_at?: string
          hero_seal_slots?: number
          id?: string
          is_archived?: boolean
          luck?: number | null
          memo?: string | null
          role_tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owned_monsters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_fruit_policies: {
        Row: {
          duplicate_policy: string
          fruit_type_id: number
          user_id: string
        }
        Insert: {
          duplicate_policy: string
          fruit_type_id: number
          user_id: string
        }
        Update: {
          duplicate_policy?: string
          fruit_type_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fruit_policies_fruit_type_id_fkey"
            columns: ["fruit_type_id"]
            isOneToOne: false
            referencedRelation: "fruit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          same_character_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          same_character_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          same_character_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_fruit_duplicates: {
        Row: {
          character_name: string | null
          copies: number | null
          copy_labels: string[] | null
          duplicate_policy: string | null
          fruit_name: string | null
          fruit_type_id: number | null
          group_key: string | null
          owned_monster_ids: string[] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipped_fruits_fruit_type_id_fkey"
            columns: ["fruit_type_id"]
            isOneToOne: false
            referencedRelation: "fruit_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
