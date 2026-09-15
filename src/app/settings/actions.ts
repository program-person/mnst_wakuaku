"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFruitTypes } from "@/lib/queries/masters";
import { isDuplicatePolicy, isSameCharacterMode } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";

const POLICY_FIELD_PREFIX = "policy_";

function toSettingsError(message: string): never {
  redirect(`/settings?error=${encodeURIComponent(message)}`);
}

/**
 * 同キャラ判定モードと、実ごとの被り方針をまとめて保存する。
 * 既定値と同じ方針は上書き行を消す（マスタの既定値を後で直したときに追従させるため）。
 */
export async function saveSettings(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const mode = formData.get("same_character_mode");
  if (!isSameCharacterMode(mode)) toSettingsError("同キャラ判定モードの値が不正です");

  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, same_character_mode: mode }, { onConflict: "user_id" });
  if (settingsError) toSettingsError(`設定の保存に失敗しました: ${settingsError.message}`);

  const fruitTypes = await getFruitTypes(supabase);
  const overrides: { user_id: string; fruit_type_id: number; duplicate_policy: string }[] = [];
  const resetToDefault: number[] = [];

  for (const type of fruitTypes) {
    const value = formData.get(`${POLICY_FIELD_PREFIX}${type.id}`);
    if (!isDuplicatePolicy(value)) continue;
    if (value === type.default_duplicate_policy) resetToDefault.push(type.id);
    else overrides.push({ user_id: userId, fruit_type_id: type.id, duplicate_policy: value });
  }

  if (resetToDefault.length > 0) {
    const { error } = await supabase.from("user_fruit_policies").delete().in("fruit_type_id", resetToDefault);
    if (error) toSettingsError(`被り方針の保存に失敗しました: ${error.message}`);
  }
  if (overrides.length > 0) {
    const { error } = await supabase
      .from("user_fruit_policies")
      .upsert(overrides, { onConflict: "user_id,fruit_type_id" });
    if (error) toSettingsError(`被り方針の保存に失敗しました: ${error.message}`);
  }

  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
