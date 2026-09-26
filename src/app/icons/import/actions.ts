"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canonicalizeFormLabel } from "@/lib/monst-forms";
import { createClient } from "@/lib/supabase/server";

const ICON_BUCKET = "character-icons";
const ICON_CONTENT_TYPE = "image/webp";
const MAX_MONSTER_NUMBER = 99_999;
const MAX_ICON_BYTES = 300_000;
const MAX_NAME_LENGTH = 80;
/** 既存のスクショアイコンより、これ以上暗ければ差し替えない（未所持で暗いアイコンが、明るいものを上書きしないように） */
const DARKER_MARGIN = 0.05;

export type CharacterMatch = {
  monsterNo: number;
  id: number;
  name: string;
  form: string | null;
  iconSource: string | null;
};

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");
  return userId;
}

function isValidMonsterNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_MONSTER_NUMBER;
}

/** 読み取った図鑑No に一致するキャラを返す（画面で「登録済み」と表示するため） */
export async function lookupCharactersByNumbers(numbers: number[]): Promise<CharacterMatch[]> {
  await requireUserId();
  const valid = [...new Set(numbers.filter(isValidMonsterNumber))];
  if (valid.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id, monster_no, name, form, icon_source")
    .in("monster_no", valid);
  if (error) throw new Error(`キャラの確認に失敗しました: ${error.message}`);
  return data.map((row) => ({
    monsterNo: row.monster_no as number,
    id: row.id,
    name: row.name,
    form: row.form,
    iconSource: row.icon_source,
  }));
}

/** 画面から送る1件分。画像は同じ FormData の `icon-{key}` に入れる */
export type ScreenshotIconEntry = {
  key: string;
  monsterNo: number;
  /** 既存キャラに付ける場合 */
  characterId?: number;
  /** 新しく登録する（または同名同形態の既存キャラに付ける）場合 */
  name?: string;
  form?: string;
  brightness: number;
  /** 図鑑由来のアイコンがあっても、スクショで上書きする */
  overwriteDictionaryIcon?: boolean;
};

export type SaveResult = {
  key: string;
  status: "saved" | "numbered" | "skipped" | "error";
  message: string;
  characterName?: string;
};

type CharacterRow = {
  id: number;
  name: string;
  monster_no: number | null;
  icon_source: string | null;
  icon_brightness: number | null;
};

type Client = Awaited<ReturnType<typeof createClient>>;

const CHARACTER_COLUMNS = "id, name, monster_no, icon_source, icon_brightness";

/**
 * 付ける先のキャラを決める。
 * 1. 指定されたキャラ ID
 * 2. 同じ図鑑No のキャラ
 * 3. 同じ名前・形態で、まだ図鑑No が無いキャラ（まとめて登録で名前だけ入れておいたコラボキャラなど）
 * 4. どれも無ければ新しく登録する
 */
async function resolveCharacter(
  supabase: Client,
  entry: ScreenshotIconEntry,
  userId: string,
): Promise<{ character: CharacterRow; created: boolean } | { error: string }> {
  if (entry.characterId !== undefined) {
    const { data, error } = await supabase.from("characters").select(CHARACTER_COLUMNS).eq("id", entry.characterId).maybeSingle();
    if (error) return { error: `キャラの取得に失敗しました: ${error.message}` };
    if (!data) return { error: "指定したキャラが見つかりません" };
    return { character: data, created: false };
  }

  const { data: byNumber, error: numberError } = await supabase
    .from("characters")
    .select(CHARACTER_COLUMNS)
    .eq("monster_no", entry.monsterNo)
    .maybeSingle();
  if (numberError) return { error: `キャラの取得に失敗しました: ${numberError.message}` };
  if (byNumber) return { character: byNumber, created: false };

  const name = (entry.name ?? "").trim();
  if (name === "") return { error: "キャラ名が入力されていません" };
  if (name.length > MAX_NAME_LENGTH) return { error: `キャラ名が長すぎます（${MAX_NAME_LENGTH}文字まで）` };
  const form = canonicalizeFormLabel(entry.form ?? "") || null;

  let sameName = supabase.from("characters").select(CHARACTER_COLUMNS).eq("name", name).is("monster_no", null);
  sameName = form === null ? sameName.is("form", null) : sameName.eq("form", form);
  const { data: candidates, error: nameError } = await sameName.limit(2);
  if (nameError) return { error: `キャラの取得に失敗しました: ${nameError.message}` };
  if (candidates.length === 1) return { character: candidates[0], created: false };

  const { data: created, error: createError } = await supabase
    .from("characters")
    .insert({ name, family_key: name, form, monster_no: entry.monsterNo, source: "screenshot", created_by: userId })
    .select(CHARACTER_COLUMNS)
    .single();
  if (createError) return { error: `キャラの登録に失敗しました: ${createError.message}` };
  return { character: created, created: true };
}

function parseEntries(raw: FormDataEntryValue | null): ScreenshotIconEntry[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is ScreenshotIconEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof item.key === "string" &&
        isValidMonsterNumber(item.monsterNo) &&
        typeof item.brightness === "number",
    );
  } catch {
    return null;
  }
}

/**
 * スクショから切り出したアイコンを保存し、キャラに図鑑No とアイコンを記録する。
 * 図鑑由来のアイコンは既定では残す。スクショ由来同士では、暗いアイコンで明るいものを上書きしない。
 */
export async function saveScreenshotIcons(formData: FormData): Promise<SaveResult[]> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const entries = parseEntries(formData.get("entries"));
  if (!entries) return [{ key: "", status: "error", message: "送信内容を読み取れませんでした" }];

  const results: SaveResult[] = [];
  for (const entry of entries) {
    const resolved = await resolveCharacter(supabase, entry, userId);
    if ("error" in resolved) {
      results.push({ key: entry.key, status: "error", message: resolved.error });
      continue;
    }
    const { character, created } = resolved;
    const notes: string[] = created ? ["キャラを新規登録"] : [];

    // 図鑑No: 空なら記録する。別の番号が入っていたら、取り違えの可能性があるので止める
    if (character.monster_no !== null && character.monster_no !== entry.monsterNo) {
      results.push({
        key: entry.key,
        status: "error",
        message: `このキャラには別の図鑑No（${character.monster_no}）が登録済みです`,
        characterName: character.name,
      });
      continue;
    }
    if (character.monster_no === null) {
      const { data: taken } = await supabase.from("characters").select("id").eq("monster_no", entry.monsterNo).maybeSingle();
      if (taken && taken.id !== character.id) {
        results.push({ key: entry.key, status: "error", message: `図鑑No ${entry.monsterNo} は別のキャラに登録済みです`, characterName: character.name });
        continue;
      }
      const { error } = await supabase.from("characters").update({ monster_no: entry.monsterNo }).eq("id", character.id);
      if (error) {
        results.push({ key: entry.key, status: "error", message: `図鑑No の記録に失敗しました: ${error.message}`, characterName: character.name });
        continue;
      }
      notes.push("図鑑Noを記録");
    }

    // アイコンを差し替えるかどうか
    if (character.icon_source === "dictionary" && !entry.overwriteDictionaryIcon) {
      results.push({ key: entry.key, status: "numbered", message: [...notes, "図鑑のアイコンを優先して残しました"].join("・"), characterName: character.name });
      continue;
    }
    if (
      character.icon_source === "screenshot" &&
      character.icon_brightness !== null &&
      entry.brightness < character.icon_brightness - DARKER_MARGIN
    ) {
      results.push({ key: entry.key, status: "numbered", message: [...notes, "今のアイコンのほうが明るいので残しました"].join("・"), characterName: character.name });
      continue;
    }

    const file = formData.get(`icon-${entry.key}`);
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_ICON_BYTES || file.type !== ICON_CONTENT_TYPE) {
      results.push({ key: entry.key, status: "error", message: "アイコン画像が不正です", characterName: character.name });
      continue;
    }

    // 保存先は毎回別名にする。表示側はこのパスを URL に含めるので、差し替えるとブラウザのキャッシュが切り替わる。
    // 差し替え前のファイルは消さずに残る（明るいアイコンへの差し替え時だけ。1枚 20KB 程度）
    const path = `screenshot/${character.id}/${Date.now()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(ICON_BUCKET)
      .upload(path, file, { contentType: ICON_CONTENT_TYPE, upsert: false });
    if (uploadError) {
      results.push({ key: entry.key, status: "error", message: `画像の保存に失敗しました: ${uploadError.message}`, characterName: character.name });
      continue;
    }
    const { error: updateError } = await supabase
      .from("characters")
      .update({ icon_path: path, icon_source: "screenshot", icon_brightness: entry.brightness, icon_fetched_at: new Date().toISOString() })
      .eq("id", character.id);
    if (updateError) {
      results.push({ key: entry.key, status: "error", message: `アイコン情報の更新に失敗しました: ${updateError.message}`, characterName: character.name });
      continue;
    }
    results.push({ key: entry.key, status: "saved", message: [...notes, "アイコンを保存"].join("・"), characterName: character.name });
  }

  revalidatePath("/characters");
  revalidatePath("/monsters");
  return results;
}
