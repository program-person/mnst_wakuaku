import { normalizeToken, parseCsv, resolveColumns, type RowError } from "@/lib/csv";
import { canonicalizeFormLabel } from "@/lib/monst-forms";

export const MAX_SLOTS = 4;
const MAX_LUCK = 99;

type FruitTypeLookup = { id: number; code: string; name: string; short_name: string };
type FruitRankLookup = { id: number; code: string; label: string };

export type OwnedSlotInstruction =
  | { slot_no: number; fruit_type_id: number; fruit_rank_id: number }
  | { slot_no: number; clear: true };

/** import_owned_monsters 関数に渡す1行 */
export type OwnedImportRow = {
  line: number;
  monster_no: string;
  name: string;
  form: string;
  copy_label: string;
  hero_seal_slots: string;
  luck: string;
  role_tag: string;
  memo: string;
  slots: OwnedSlotInstruction[];
};

type BaseColumn = "monster_no" | "name" | "form" | "copy_label" | "hero_seal_slots" | "luck" | "role_tag" | "memo";
type SlotColumn = `slot${1 | 2 | 3 | 4}_${"fruit" | "rank"}`;
type OwnedColumn = BaseColumn | SlotColumn;

const SLOT_NUMBERS = [1, 2, 3, 4] as const;

export const OWNED_CSV_COLUMNS: OwnedColumn[] = [
  "monster_no",
  "name",
  "form",
  "copy_label",
  "hero_seal_slots",
  "luck",
  "role_tag",
  "memo",
  ...SLOT_NUMBERS.flatMap((slotNo) => [`slot${slotNo}_fruit`, `slot${slotNo}_rank`] as SlotColumn[]),
];

const BASE_ALIASES: Record<BaseColumn, readonly string[]> = {
  monster_no: ["monster_no", "図鑑no", "no", "no.", "図鑑番号"],
  name: ["name", "名前", "キャラ名", "キャラクター名"],
  form: ["form", "形態", "進化形態"],
  copy_label: ["copy_label", "何体目", "体目", "個体"],
  hero_seal_slots: ["hero_seal_slots", "枠数", "実の枠数", "証", "英雄の証"],
  luck: ["luck", "ラック"],
  role_tag: ["role_tag", "役割", "役割タグ", "タグ"],
  memo: ["memo", "メモ", "備考"],
};

function buildAliases(): Record<OwnedColumn, readonly string[]> {
  const aliases = { ...BASE_ALIASES } as Record<OwnedColumn, readonly string[]>;
  for (const slotNo of SLOT_NUMBERS) {
    aliases[`slot${slotNo}_fruit`] = [`slot${slotNo}_fruit`, `実${slotNo}`, `わくわくの実${slotNo}`, `スロット${slotNo}`];
    aliases[`slot${slotNo}_rank`] = [`slot${slotNo}_rank`, `等級${slotNo}`, `実${slotNo}等級`];
  }
  return aliases;
}

const OWNED_ALIASES = buildAliases();

/** 表記ゆれ吸収用：空白と「の力」を除いた正規化 */
function normalizeFruitToken(value: string): string {
  return normalizeToken(value).replace(/\s+/g, "").replace(/の力$/, "");
}

export function buildFruitTypeIndex(fruitTypes: FruitTypeLookup[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const type of fruitTypes) {
    for (const key of [type.name, type.short_name, type.code]) {
      index.set(normalizeFruitToken(key), type.id);
    }
  }
  return index;
}

/** 「特級L」「特L」「spl」のいずれでも引けるようにする */
export function buildFruitRankIndex(fruitRanks: FruitRankLookup[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const rank of fruitRanks) {
    for (const key of [rank.label, rank.label.replace("級", ""), rank.code]) {
      index.set(normalizeToken(key).replace(/\s+/g, ""), rank.id);
    }
  }
  return index;
}

export type ParsedOwnedCsv = { rows: OwnedImportRow[]; errors: RowError[] };

/**
 * 所持データCSVを取り込み行に変換する。実と等級の名前はここでIDに解決する。
 * スロット列がヘッダにあってセルが空なら「外す」、列自体が無ければ「触らない」。
 */
export function parseOwnedCsv(
  text: string,
  fruitTypes: FruitTypeLookup[],
  fruitRanks: FruitRankLookup[],
): ParsedOwnedCsv {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "ファイルが空です" }] };

  const columnIndex = resolveColumns(table[0], OWNED_ALIASES);
  if (!columnIndex.has("name") && !columnIndex.has("monster_no")) {
    return { rows: [], errors: [{ line: 1, message: "ヘッダに name（名前）か monster_no（図鑑No）列が必要です" }] };
  }

  const fruitTypeIndex = buildFruitTypeIndex(fruitTypes);
  const fruitRankIndex = buildFruitRankIndex(fruitRanks);

  const rows: OwnedImportRow[] = [];
  const errors: RowError[] = [];

  rowLoop: for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const line = rowIndex + 1;
    const cells = table[rowIndex];
    const read = (column: OwnedColumn): string => {
      const index = columnIndex.get(column);
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };

    const monsterNo = read("monster_no").normalize("NFKC");
    const name = read("name");
    if (monsterNo === "" && name === "") {
      errors.push({ line, message: "図鑑Noと名前がどちらも空です" });
      continue;
    }
    if (monsterNo !== "" && !/^\d+$/.test(monsterNo)) {
      errors.push({ line, message: `図鑑Noが数値ではありません: ${monsterNo}` });
      continue;
    }

    const heroSealSlots = read("hero_seal_slots").normalize("NFKC");
    if (heroSealSlots !== "" && !(/^\d$/.test(heroSealSlots) && Number(heroSealSlots) <= MAX_SLOTS)) {
      errors.push({ line, message: `枠数は 0〜${MAX_SLOTS} で入力してください: ${heroSealSlots}` });
      continue;
    }

    const luck = read("luck").normalize("NFKC");
    if (luck !== "" && !(/^\d{1,2}$/.test(luck) && Number(luck) <= MAX_LUCK)) {
      errors.push({ line, message: `ラックは 0〜${MAX_LUCK} で入力してください: ${luck}` });
      continue;
    }

    const copyLabel = read("copy_label").normalize("NFKC").replace(/体目$/, "");

    const slots: OwnedSlotInstruction[] = [];
    const usedFruitTypeIds = new Set<number>();
    for (const slotNo of SLOT_NUMBERS) {
      const fruitColumn: SlotColumn = `slot${slotNo}_fruit`;
      const rankColumn: SlotColumn = `slot${slotNo}_rank`;
      if (!columnIndex.has(fruitColumn)) continue;

      const fruitText = read(fruitColumn);
      const rankText = read(rankColumn);
      if (fruitText === "" && rankText === "") {
        slots.push({ slot_no: slotNo, clear: true });
        continue;
      }
      if (fruitText === "") {
        errors.push({ line, message: `スロット${slotNo}: 等級だけあって実が空です` });
        continue rowLoop;
      }
      const fruitTypeId = fruitTypeIndex.get(normalizeFruitToken(fruitText));
      if (fruitTypeId === undefined) {
        errors.push({ line, message: `スロット${slotNo}: 実「${fruitText}」がマスタにありません` });
        continue rowLoop;
      }
      if (rankText === "") {
        errors.push({ line, message: `スロット${slotNo}: 等級が空です` });
        continue rowLoop;
      }
      const fruitRankId = fruitRankIndex.get(normalizeToken(rankText).replace(/\s+/g, ""));
      if (fruitRankId === undefined) {
        errors.push({ line, message: `スロット${slotNo}: 等級「${rankText}」を認識できません` });
        continue rowLoop;
      }
      if (usedFruitTypeIds.has(fruitTypeId)) {
        errors.push({ line, message: `スロット${slotNo}: 同じ個体に同じ実「${fruitText}」が重複しています` });
        continue rowLoop;
      }
      usedFruitTypeIds.add(fruitTypeId);
      slots.push({ slot_no: slotNo, fruit_type_id: fruitTypeId, fruit_rank_id: fruitRankId });
    }

    rows.push({
      line,
      monster_no: monsterNo,
      name,
      // 表記ゆれで別キャラとして作られないよう、図鑑と同じ表記にそろえてから照合する
      form: canonicalizeFormLabel(read("form")),
      copy_label: copyLabel,
      hero_seal_slots: heroSealSlots,
      luck,
      role_tag: read("role_tag"),
      memo: read("memo"),
      slots,
    });
  }

  return { rows, errors };
}
