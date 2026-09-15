import { toCsvLine } from "@/lib/csv";
import { MAX_SLOTS, OWNED_CSV_COLUMNS } from "@/lib/owned-csv";
import { listOwnedMonsters } from "@/lib/queries/owned-monsters";
import { createClient } from "@/lib/supabase/server";

const UTF8_BOM = "﻿";

/** 自分の所持データ（アーカイブ除く）を、そのまま再インポートできる形式で書き出す */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) {
    return new Response("unauthorized", { status: 401 });
  }

  let monsters;
  try {
    monsters = await listOwnedMonsters(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(message, { status: 500 });
  }

  monsters.sort(
    (a, b) =>
      (a.character.monster_no ?? Number.MAX_SAFE_INTEGER) - (b.character.monster_no ?? Number.MAX_SAFE_INTEGER) ||
      a.character.name.localeCompare(b.character.name, "ja") ||
      a.copy_label.localeCompare(b.copy_label, "ja", { numeric: true }),
  );

  const lines = [toCsvLine(OWNED_CSV_COLUMNS)];
  for (const monster of monsters) {
    const slotCells: string[] = [];
    for (let slotNo = 1; slotNo <= MAX_SLOTS; slotNo++) {
      const fruit = monster.equipped_fruits.find((item) => item.slot_no === slotNo);
      slotCells.push(fruit?.fruit_type.name ?? "", fruit?.fruit_rank.label ?? "");
    }
    lines.push(
      toCsvLine([
        monster.character.monster_no,
        monster.character.name,
        monster.character.form,
        monster.copy_label,
        monster.hero_seal_slots,
        monster.luck,
        monster.role_tag,
        monster.memo,
        ...slotCells,
      ]),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Response(UTF8_BOM + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="owned_monsters_${today}.csv"`,
    },
  });
}
