"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MAX_ALIAS_LENGTH = 50;
// 一意制約違反（同じ別名が正規化後に既にある）
const UNIQUE_VIOLATION = "23505";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function backToCharacter(characterId: string, error?: string): never {
  const suffix = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/characters/${characterId}${suffix}`);
}

export async function addCharacterAlias(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const characterId = readText(formData, "character_id");
  const alias = readText(formData, "alias");
  if (!/^\d+$/.test(characterId)) throw new Error("キャラの指定が不正です");
  if (alias === "") backToCharacter(characterId, "別名を入力してください");
  if (alias.length > MAX_ALIAS_LENGTH) backToCharacter(characterId, `別名は ${MAX_ALIAS_LENGTH} 文字以内にしてください`);

  const { error } = await supabase
    .from("character_aliases")
    .insert({ character_id: Number(characterId), alias, created_by: userId });
  if (error?.code === UNIQUE_VIOLATION) backToCharacter(characterId, `「${alias}」は既に登録されています（表記ゆれ込み）`);
  if (error) backToCharacter(characterId, `別名の追加に失敗しました: ${error.message}`);

  revalidatePath(`/characters/${characterId}`);
  revalidatePath("/characters");
  backToCharacter(characterId);
}

export async function deleteCharacterAlias(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const characterId = readText(formData, "character_id");
  const aliasId = readText(formData, "alias_id");
  if (!/^\d+$/.test(characterId) || !/^\d+$/.test(aliasId)) throw new Error("別名の指定が不正です");

  const { error } = await supabase.from("character_aliases").delete().eq("id", Number(aliasId));
  if (error) backToCharacter(characterId, `別名の削除に失敗しました: ${error.message}`);

  revalidatePath(`/characters/${characterId}`);
  revalidatePath("/characters");
  backToCharacter(characterId);
}
