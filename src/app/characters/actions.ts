"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCharacterCsv } from "@/lib/character-csv";
import { decodeCsvBytes } from "@/lib/csv";
import { MAX_REPORTED_ERRORS, type ImportState } from "@/lib/import-state";
import { createClient } from "@/lib/supabase/server";

const IMPORT_CHUNK_SIZE = 1000;

/**
 * CSVファイルからキャラマスタを取り込む。useActionState から呼ぶ。
 * 検証は TS 側、upsert は DB 関数 import_characters で一括処理する。
 */
export async function importCharacters(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "CSVファイルを選択してください" };
  }

  const { text, encoding } = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const parsed = parseCharacterCsv(text);

  if (parsed.rows.length === 0) {
    return { status: "error", message: parsed.errors[0]?.message ?? "取り込める行がありません" };
  }

  let inserted = 0;
  let updated = 0;
  let aliasesAdded = 0;
  for (let offset = 0; offset < parsed.rows.length; offset += IMPORT_CHUNK_SIZE) {
    const chunk = parsed.rows.slice(offset, offset + IMPORT_CHUNK_SIZE);
    const { data, error } = await supabase.rpc("import_characters", { rows: chunk });
    if (error) {
      return {
        status: "error",
        message: `${offset + 1}件目以降の取り込みでエラー: ${error.message}（それ以前の ${inserted + updated} 件は保存済み）`,
      };
    }
    inserted += data[0]?.inserted ?? 0;
    updated += data[0]?.updated ?? 0;
    aliasesAdded += data[0]?.aliases_added ?? 0;
  }

  revalidatePath("/characters");

  return {
    status: "done",
    encoding,
    stats: [
      { label: "読み取った行", value: parsed.rows.length + parsed.errors.length },
      { label: "新規登録", value: inserted },
      { label: "更新", value: updated },
      { label: "スキップ（既存と同名同形態 / ファイル内重複）", value: parsed.rows.length - inserted - updated },
      { label: "別名を追加", value: aliasesAdded },
    ],
    errors: parsed.errors.slice(0, MAX_REPORTED_ERRORS),
    errorCount: parsed.errors.length,
  };
}
