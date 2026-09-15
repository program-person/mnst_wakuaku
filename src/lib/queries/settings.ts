import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FruitType } from "@/lib/queries/masters";

type Client = SupabaseClient<Database>;

/** family = 形態違いも同キャラ扱い / character = 図鑑（キャラマスタの行）単位 */
export type SameCharacterMode = "family" | "character";

export const DEFAULT_SAME_CHARACTER_MODE: SameCharacterMode = "family";

export const SAME_CHARACTER_MODE_LABELS: Record<SameCharacterMode, { title: string; description: string }> = {
  family: {
    title: "形態違いも同キャラ扱い",
    description: "同キャラキーが同じなら、進化・神化・獣神化などが違っても被りとみなす",
  },
  character: {
    title: "キャラマスタの行ごと",
    description: "形態が違えば別キャラとして扱う",
  },
};

export function isSameCharacterMode(value: unknown): value is SameCharacterMode {
  return value === "family" || value === "character";
}

export const DUPLICATE_POLICIES = ["avoid", "allow", "prefer"] as const;
export type DuplicatePolicy = (typeof DUPLICATE_POLICIES)[number];

export function isDuplicatePolicy(value: unknown): value is DuplicatePolicy {
  return typeof value === "string" && (DUPLICATE_POLICIES as readonly string[]).includes(value);
}

/** ログイン中ユーザーの同キャラ判定モード。設定行が無ければ既定値 */
export async function getSameCharacterMode(supabase: Client): Promise<SameCharacterMode> {
  const { data, error } = await supabase.from("user_settings").select("same_character_mode").maybeSingle();
  if (error) throw new Error(`設定の取得に失敗しました: ${error.message}`);
  return isSameCharacterMode(data?.same_character_mode) ? data.same_character_mode : DEFAULT_SAME_CHARACTER_MODE;
}

/** 実の種類ID → 被り方針（ユーザー上書きを反映済み） */
export async function getDuplicatePolicies(
  supabase: Client,
  fruitTypes: FruitType[],
): Promise<Record<number, DuplicatePolicy>> {
  const { data, error } = await supabase.from("user_fruit_policies").select("fruit_type_id, duplicate_policy");
  if (error) throw new Error(`被り方針の取得に失敗しました: ${error.message}`);

  const policies: Record<number, DuplicatePolicy> = {};
  for (const type of fruitTypes) {
    policies[type.id] = isDuplicatePolicy(type.default_duplicate_policy) ? type.default_duplicate_policy : "avoid";
  }
  for (const row of data) {
    if (isDuplicatePolicy(row.duplicate_policy)) policies[row.fruit_type_id] = row.duplicate_policy;
  }
  return policies;
}
