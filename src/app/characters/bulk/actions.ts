"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseBulkCharacters } from "@/lib/bulk-characters";
import { MAX_REPORTED_ERRORS, type ImportState } from "@/lib/import-state";
import { COMMON_FORMS } from "@/lib/monst-forms";
import { createClient } from "@/lib/supabase/server";

const IMPORT_CHUNK_SIZE = 200;
const MAX_INPUT_LENGTH = 100_000;

/**
 * 貼り付けた名前の一覧からキャラマスタに登録する。図鑑に載っていないコラボキャラ用。
 * 保存は CSV 取り込みと同じ DB 関数を使うので、同名同形態の既存キャラは二重登録されない。
 */
export async function importBulkCharacters(_previous: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) redirect("/login");

  const text = formData.get("lines");
  const defaultFormValue = formData.get("default_form");
  if (typeof text !== "string" || text.trim() === "") {
    return { status: "error", message: "キャラ名を1行に1つずつ入力してください" };
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return { status: "error", message: "入力が長すぎます。何回かに分けてください" };
  }
  const defaultForm =
    typeof defaultFormValue === "string" && (COMMON_FORMS as readonly string[]).includes(defaultFormValue)
      ? defaultFormValue
      : COMMON_FORMS[0];

  const parsed = parseBulkCharacters(text, defaultForm);
  if (parsed.rows.length === 0) {
    return { status: "error", message: parsed.errors[0]?.message ?? "登録できる行がありません" };
  }

  let inserted = 0;
  let aliasesAdded = 0;
  for (let offset = 0; offset < parsed.rows.length; offset += IMPORT_CHUNK_SIZE) {
    const chunk = parsed.rows.slice(offset, offset + IMPORT_CHUNK_SIZE);
    const { data, error } = await supabase.rpc("import_characters", { rows: chunk });
    if (error) {
      return {
        status: "error",
        message: `${offset + 1}件目以降でエラー: ${error.message}（それ以前の ${inserted} 件は保存済み）`,
      };
    }
    inserted += data[0]?.inserted ?? 0;
    aliasesAdded += data[0]?.aliases_added ?? 0;
  }

  revalidatePath("/characters");

  return {
    status: "done",
    // 貼り付け欄なので文字コードの判別は関係ないが、表示は CSV 取り込みと同じ形にそろえている
    encoding: "utf-8",
    stats: [
      { label: "読み取った行", value: parsed.rows.length + parsed.errors.length },
      { label: "新規登録", value: inserted },
      { label: "既にあったキャラ", value: parsed.rows.length - inserted },
      { label: "通称を追加", value: aliasesAdded },
    ],
    errors: parsed.errors.slice(0, MAX_REPORTED_ERRORS),
    errorCount: parsed.errors.length,
  };
}
