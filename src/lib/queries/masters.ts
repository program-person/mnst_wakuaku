import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type FruitType = Tables<"fruit_types">;
export type FruitRank = Tables<"fruit_ranks">;

type Client = SupabaseClient<Database>;

export async function getFruitTypes(supabase: Client): Promise<FruitType[]> {
  const { data, error } = await supabase
    .from("fruit_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`実マスタの取得に失敗しました: ${error.message}`);
  return data;
}

export async function getFruitRanks(supabase: Client): Promise<FruitRank[]> {
  const { data, error } = await supabase.from("fruit_ranks").select("*").order("rank_value");
  if (error) throw new Error(`等級マスタの取得に失敗しました: ${error.message}`);
  return data;
}

/** カテゴリコードの表示名 */
export const FRUIT_CATEGORY_LABELS: Record<string, string> = {
  attack: "絆（加撃・加速・加命）",
  support: "サポート",
  survival: "耐久",
  quest_reward: "クエスト報酬",
  other: "その他",
};

export const DUPLICATE_POLICY_LABELS: Record<string, string> = {
  avoid: "被りNG",
  allow: "被りOK",
  prefer: "被り推奨",
};
