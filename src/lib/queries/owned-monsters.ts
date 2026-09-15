import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * 同キャラ（family_key が同じ）の他個体が装着している実を返す。
 * 装着画面で「この実は◯体目が既に持っている」と警告するために使う。
 */
export async function listSiblingEquippedFruits(
  supabase: Client,
  familyKey: string,
  excludeOwnedMonsterId: string,
): Promise<{ owned_monster_id: string; copy_label: string; fruit_type_id: number }[]> {
  const { data, error } = await supabase
    .from("owned_monsters")
    .select("id, copy_label, character:characters!inner(family_key), equipped_fruits(fruit_type_id)")
    .eq("character.family_key", familyKey)
    .eq("is_archived", false)
    .neq("id", excludeOwnedMonsterId);
  if (error) throw new Error(`同キャラの実の取得に失敗しました: ${error.message}`);

  return data.flatMap((row) =>
    row.equipped_fruits.map((fruit) => ({
      owned_monster_id: row.id,
      copy_label: row.copy_label,
      fruit_type_id: fruit.fruit_type_id,
    })),
  );
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
