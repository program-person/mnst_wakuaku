"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCharacterCsv, type RowError } from "@/lib/character-csv";
import { decodeCsvBytes, type DetectedEncoding } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

const IMPORT_CHUNK_SIZE = 1000;
const MAX_REPORTED_ERRORS = 50;

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      encoding: DetectedEncoding;
      totalRows: number;
      inserted: number;
      updated: number;
      skipped: number;
      errors: RowError[];
      errorCount: number;
    };

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
    const firstError = parsed.errors[0]?.message ?? "取り込める行がありません";
    return { status: "error", message: firstError };
  }

  let inserted = 0;
  let updated = 0;
  for (let offset = 0; offset < parsed.rows.length; offset += IMPORT_CHUNK_SIZE) {
    const chunk = parsed.rows.slice(offset, offset + IMPORT_CHUNK_SIZE);
    const { data, error } = await supabase.rpc("import_characters", { rows: chunk });
    if (error) {
      return {
        status: "error",
        message: `${offset + 1}行目以降の取り込みでエラー: ${error.message}（それ以前の ${inserted + updated} 件は保存済み）`,
      };
    }
    const result = data[0];
    inserted += result?.inserted ?? 0;
    updated += result?.updated ?? 0;
  }

  revalidatePath("/characters");

  return {
    status: "done",
    encoding,
    totalRows: parsed.rows.length + parsed.errors.length,
    inserted,
    updated,
    skipped: parsed.rows.length - inserted - updated,
    errors: parsed.errors.slice(0, MAX_REPORTED_ERRORS),
    errorCount: parsed.errors.length,
  };
}
