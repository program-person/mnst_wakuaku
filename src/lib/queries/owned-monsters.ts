import type { SupabaseClient } from "@supabase/supabase-js";
import type { SameCharacterMode } from "@/lib/queries/settings";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Character = Tables<"characters">;
export type OwnedMonster = Tables<"owned_monsters">;
export type EquippedFruit = Tables<"equipped_fruits">;

export type OwnedMonsterWithDetails = OwnedMonster & {
  character: Character;
  equipped_fruits: (EquippedFruit & {
    fruit_type: Pick<Tables<"fruit_types">, "id" | "name" | "short_name" | "category">;
    fruit_rank: Pick<Tables<"fruit_ranks">, "id" | "label" | "rank_value">;
  })[];
};

const OWNED_MONSTER_SELECT = `
  *,
  character:characters(*),
  equipped_fruits(
    *,
    fruit_type:fruit_types(id, name, short_name, category),
    fruit_rank:fruit_ranks(id, label, rank_value)
  )
` as const;

export async function listOwnedMonsters(supabase: Client): Promise<OwnedMonsterWithDetails[]> {
  const { data, error } = await supabase
    .from("owned_monsters")
    .select(OWNED_MONSTER_SELECT)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`所持キャラの取得に失敗しました: ${error.message}`);
  return data as OwnedMonsterWithDetails[];
}

export async function getOwnedMonster(
  supabase: Client,
  id: string,
): Promise<OwnedMonsterWithDetails | null> {
  const { data, error } = await supabase
    .from("owned_monsters")
    .select(OWNED_MONSTER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`所持キャラの取得に失敗しました: ${error.message}`);
  return (data as OwnedMonsterWithDetails | null) ?? null;
}

export type SameCharacterCopy = { id: string; copy_label: string; fruit_type_ids: number[] };

/**
 * 同キャラとみなす個体（アーカイブ除く）を返す。判定はユーザー設定のモードに従う。
 * - family: family_key が同じキャラの個体
 * - character: 同じキャラマスタ行の個体
 * 装着画面の被り警告と、複製時の◯体目の採番に使う。
 */
export async function listSameCharacterCopies(
  supabase: Client,
  character: { id: number; family_key: string },
  mode: SameCharacterMode,
): Promise<SameCharacterCopy[]> {
  const base = supabase
    .from("owned_monsters")
    .select("id, copy_label, character:characters!inner(id, family_key), equipped_fruits(fruit_type_id)")
    .eq("is_archived", false);
  const request =
    mode === "family" ? base.eq("character.family_key", character.family_key) : base.eq("character_id", character.id);

  const { data, error } = await request;
  if (error) throw new Error(`同キャラの個体の取得に失敗しました: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    copy_label: row.copy_label,
    fruit_type_ids: row.equipped_fruits.map((fruit) => fruit.fruit_type_id),
  }));
}

export type FruitDuplicate = Tables<"v_fruit_duplicates">;

export async function listFruitDuplicates(supabase: Client): Promise<FruitDuplicate[]> {
  const { data, error } = await supabase
    .from("v_fruit_duplicates")
    .select("*")
    .order("character_name")
    .order("fruit_name");
  if (error) throw new Error(`被り一覧の取得に失敗しました: ${error.message}`);
  return data;
}
