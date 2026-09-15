"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextCopyLabel } from "@/lib/copy-label";
import { createClient } from "@/lib/supabase/server";

const MAX_HERO_SEAL_SLOTS = 4;

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) redirect("/login");
  return userId;
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readInt(formData: FormData, key: string): number | null {
  const raw = readText(formData, key);
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 所持個体を追加する。既存キャラを選ぶか、新規キャラを同時に作成する。
 */
export async function createOwnedMonster(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  let characterId = readInt(formData, "character_id");

  if (characterId === null) {
    const name = readText(formData, "new_character_name");
    if (name === "") {
      redirect(`/monsters/new?error=${encodeURIComponent("キャラを選ぶか、新規キャラ名を入力してください")}`);
    }
    const familyKey = readText(formData, "new_character_family_key") || name;
    const form = readText(formData, "new_character_form") || null;
    const monsterNo = readInt(formData, "new_character_monster_no");

    const { data: created, error: createError } = await supabase
      .from("characters")
      .insert({
        name,
        family_key: familyKey,
        form,
        monster_no: monsterNo,
        created_by: userId,
        source: "manual",
      })
      .select("id")
      .single();
    if (createError) {
      redirect(`/monsters/new?error=${encodeURIComponent(`キャラの作成に失敗しました: ${createError.message}`)}`);
    }
    characterId = created.id;
  }

  const heroSealSlots = readInt(formData, "hero_seal_slots") ?? 0;
  if (heroSealSlots < 0 || heroSealSlots > MAX_HERO_SEAL_SLOTS) {
    redirect(`/monsters/new?error=${encodeURIComponent("実の枠数は0〜4で入力してください")}`);
  }

  const { data: inserted, error } = await supabase
    .from("owned_monsters")
    .insert({
      user_id: userId,
      character_id: characterId,
      copy_label: readText(formData, "copy_label") || "1",
      hero_seal_slots: heroSealSlots,
      luck: readInt(formData, "luck"),
      role_tag: readText(formData, "role_tag") || null,
      memo: readText(formData, "memo") || null,
    })
    .select("id")
    .single();
  if (error) {
    redirect(`/monsters/new?error=${encodeURIComponent(`登録に失敗しました: ${error.message}`)}`);
  }

  revalidatePath("/monsters");
  redirect(`/monsters/${inserted.id}`);
}

/**
 * 既存個体をもとに同キャラの次の個体を作る（◯体目を自動採番）。
 * 実はコピーしない。「別の実を付けるための2体目」を素早く作る用途なので。
 */
export async function duplicateOwnedMonster(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const sourceId = readText(formData, "source_id");
  if (sourceId === "") throw new Error("複製元の個体が指定されていません");

  const { data: source, error: sourceError } = await supabase
    .from("owned_monsters")
    .select("id, character_id, hero_seal_slots, role_tag, character:characters!inner(family_key)")
    .eq("id", sourceId)
    .maybeSingle();
  if (sourceError) throw new Error(`複製元の取得に失敗しました: ${sourceError.message}`);
  if (!source) throw new Error("複製元の個体が見つかりません");

  const { data: siblings, error: siblingsError } = await supabase
    .from("owned_monsters")
    .select("copy_label, character:characters!inner(family_key)")
    .eq("character.family_key", source.character.family_key)
    .eq("is_archived", false);
  if (siblingsError) throw new Error(`同キャラの取得に失敗しました: ${siblingsError.message}`);

  const { data: inserted, error } = await supabase
    .from("owned_monsters")
    .insert({
      user_id: userId,
      character_id: source.character_id,
      copy_label: nextCopyLabel(siblings.map((row) => row.copy_label)),
      hero_seal_slots: source.hero_seal_slots,
      // 役割は個体ごとに違うのが普通なので引き継がない
      role_tag: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`複製に失敗しました: ${error.message}`);

  revalidatePath("/monsters");
  redirect(`/monsters/${inserted.id}`);
}

/** スロットに実を装着（既にあれば置き換え） */
export async function setEquippedFruit(input: {
  ownedMonsterId: string;
  slotNo: number;
  fruitTypeId: number;
  fruitRankId: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  const supabase = await createClient();

  if (input.slotNo < 1 || input.slotNo > MAX_HERO_SEAL_SLOTS) {
    return { ok: false, error: "スロット番号が不正です" };
  }

  const { data: previous } = await supabase
    .from("equipped_fruits")
    .select("fruit_type_id, fruit_rank_id")
    .eq("owned_monster_id", input.ownedMonsterId)
    .eq("slot_no", input.slotNo)
    .maybeSingle();

  const { error } = await supabase.from("equipped_fruits").upsert(
    {
      owned_monster_id: input.ownedMonsterId,
      slot_no: input.slotNo,
      fruit_type_id: input.fruitTypeId,
      fruit_rank_id: input.fruitRankId,
    },
    { onConflict: "owned_monster_id,slot_no" },
  );
  if (error) return { ok: false, error: `装着に失敗しました: ${error.message}` };

  const { error: logError } = await supabase.from("fruit_events").insert({
    user_id: userId,
    owned_monster_id: input.ownedMonsterId,
    event_type: previous ? "replace" : "attach",
    payload: { slot_no: input.slotNo, previous, next: { fruit_type_id: input.fruitTypeId, fruit_rank_id: input.fruitRankId } },
  });
  if (logError) {
    // 履歴の失敗は本処理を巻き戻さない。ログだけ残す
    console.error("fruit_events insert failed", logError.message);
  }

  revalidatePath(`/monsters/${input.ownedMonsterId}`);
  revalidatePath("/monsters");
  revalidatePath("/duplicates");
  return { ok: true };
}

/** スロットの実を外す */
export async function clearEquippedFruit(input: {
  ownedMonsterId: string;
  slotNo: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from("equipped_fruits")
    .delete()
    .eq("owned_monster_id", input.ownedMonsterId)
    .eq("slot_no", input.slotNo)
    .select("fruit_type_id, fruit_rank_id")
    .maybeSingle();
  if (error) return { ok: false, error: `取り外しに失敗しました: ${error.message}` };

  if (removed) {
    await supabase.from("fruit_events").insert({
      user_id: userId,
      owned_monster_id: input.ownedMonsterId,
      event_type: "detach",
      payload: { slot_no: input.slotNo, previous: removed },
    });
  }

  revalidatePath(`/monsters/${input.ownedMonsterId}`);
  revalidatePath("/monsters");
  revalidatePath("/duplicates");
  return { ok: true };
}

/** 個体をアーカイブ（合成・売却などで手放したとき。履歴は残す） */
export async function archiveOwnedMonster(formData: FormData): Promise<void> {
  await requireUserId();
  const supabase = await createClient();
  const id = readText(formData, "id");
  if (id === "") return;

  const { error } = await supabase.from("owned_monsters").update({ is_archived: true }).eq("id", id);
  if (error) throw new Error(`アーカイブに失敗しました: ${error.message}`);

  revalidatePath("/monsters");
  revalidatePath("/duplicates");
  redirect("/monsters");
}
