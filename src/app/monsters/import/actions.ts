"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decodeCsvBytes, type RowError } from "@/lib/csv";
import { MAX_REPORTED_ERRORS, type ImportState } from "@/lib/import-state";
import { parseOwnedCsv } from "@/lib/owned-csv";
import { getFruitRanks, getFruitTypes } from "@/lib/queries/masters";
import { createClient } from "@/lib/supabase/server";

// DB 関数は行ごとにサブトランザクションを張るので、キャラCSVより小さく刻む
const IMPORT_CHUNK_SIZE = 300;

function isRowError(value: unknown): value is RowError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RowError).line === "number" &&
    typeof (value as RowError).message === "string"
  );
}

/** 所持データ（個体・実・等級）をCSVから取り込む */
export async function importOwnedMonsters(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "CSVファイルを選択してください" };
  }

  const [fruitTypes, fruitRanks] = await Promise.all([getFruitTypes(supabase), getFruitRanks(supabase)]);
  const { text, encoding } = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const parsed = parseOwnedCsv(text, fruitTypes, fruitRanks);

  if (parsed.rows.length === 0) {
    return { status: "error", message: parsed.errors[0]?.message ?? "取り込める行がありません" };
  }

  let inserted = 0;
  let updated = 0;
  let charactersCreated = 0;
  const databaseErrors: RowError[] = [];

  for (let offset = 0; offset < parsed.rows.length; offset += IMPORT_CHUNK_SIZE) {
    const chunk = parsed.rows.slice(offset, offset + IMPORT_CHUNK_SIZE);
    const { data, error } = await supabase.rpc("import_owned_monsters", { rows: chunk });
    if (error) {
      return {
        status: "error",
        message: `${chunk[0].line}行目以降の取り込みでエラー: ${error.message}（それ以前の ${inserted + updated} 件は保存済み）`,
      };
    }
    const result = data[0];
    if (!result) continue;
    inserted += result.inserted;
    updated += result.updated;
    charactersCreated += result.characters_created;
    if (Array.isArray(result.errors)) {
      databaseErrors.push(...result.errors.filter(isRowError));
    }
  }

  revalidatePath("/monsters");
  revalidatePath("/duplicates");
  revalidatePath("/characters");

  const allErrors = [...parsed.errors, ...databaseErrors].sort((a, b) => a.line - b.line);

  return {
    status: "done",
    encoding,
    stats: [
      { label: "読み取った行", value: parsed.rows.length + parsed.errors.length },
      { label: "個体を新規登録", value: inserted },
      { label: "個体を更新", value: updated },
      { label: "キャラマスタに自動追加", value: charactersCreated },
    ],
    errors: allErrors.slice(0, MAX_REPORTED_ERRORS),
    errorCount: allErrors.length,
  };
}
