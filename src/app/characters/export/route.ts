import { CHARACTER_CSV_COLUMNS } from "@/lib/character-csv";
import { toCsvLine } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const UTF8_BOM = "﻿";

/** キャラマスタ全件を CSV でダウンロードする。Excel で開けるよう BOM 付き UTF-8 */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) {
    return new Response("unauthorized", { status: 401 });
  }

  const lines: string[] = [toCsvLine([...CHARACTER_CSV_COLUMNS])];

  // PostgREST の1回あたりの上限（既定1000行）を超えないようページングする
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("characters")
      .select("monster_no, name, name_kana, family_key, form, element, rarity, series")
      .order("monster_no", { ascending: true, nullsFirst: false })
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      return new Response(`エクスポートに失敗しました: ${error.message}`, { status: 500 });
    }
    for (const row of data) {
      lines.push(toCsvLine(CHARACTER_CSV_COLUMNS.map((column) => row[column])));
    }
    if (data.length < PAGE_SIZE) break;
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Response(UTF8_BOM + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="characters_${today}.csv"`,
    },
  });
}
