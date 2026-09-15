import { parseCsv } from "@/lib/csv";

/** import_characters 関数に渡す1行。すべて文字列で渡し、型変換はDB側で行う */
export type CharacterCsvRow = {
  monster_no: string;
  name: string;
  name_kana: string;
  family_key: string;
  form: string;
  element: string;
  rarity: string;
  series: string;
};

export const CHARACTER_CSV_COLUMNS = [
  "monster_no",
  "name",
  "name_kana",
  "family_key",
  "form",
  "element",
  "rarity",
  "series",
] as const satisfies readonly (keyof CharacterCsvRow)[];

/** 受け付けるヘッダ名（英語の正式名と日本語の別名）。比較は小文字化して行う */
const HEADER_ALIASES: Record<keyof CharacterCsvRow, string[]> = {
  monster_no: ["monster_no", "図鑑no", "no", "no.", "番号", "図鑑番号"],
  name: ["name", "名前", "キャラ名", "キャラクター名", "モンスター名"],
  name_kana: ["name_kana", "kana", "かな", "よみ", "読み", "ふりがな"],
  family_key: ["family_key", "同キャラキー", "判定キー", "ベース名", "同キャラ"],
  form: ["form", "形態", "進化形態", "進化"],
  element: ["element", "属性"],
  rarity: ["rarity", "レア度", "レアリティ", "星", "★"],
  series: ["series", "シリーズ", "ガチャ", "入手"],
};

const MAX_RARITY = 9;

export type RowError = { line: number; message: string };

export type ParsedCharacterCsv = {
  rows: CharacterCsvRow[];
  errors: RowError[];
  /** ヘッダ行で認識できた列 */
  recognizedColumns: (keyof CharacterCsvRow)[];
};

function normalizeHeader(cell: string): string {
  return cell.replace(/^﻿/, "").trim().toLowerCase();
}

/**
 * CSVテキストをキャラ行に変換する。ヘッダ行必須。
 * 行番号（line）はファイル先頭を1行目として数える（ヘッダが1行目）。
 */
export function parseCharacterCsv(text: string): ParsedCharacterCsv {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "ファイルが空です" }], recognizedColumns: [] };
  }

  const header = table[0].map(normalizeHeader);
  const columnIndex = new Map<keyof CharacterCsvRow, number>();
  for (const column of CHARACTER_CSV_COLUMNS) {
    const aliases = HEADER_ALIASES[column];
    const index = header.findIndex((cell) => aliases.includes(cell));
    if (index >= 0) columnIndex.set(column, index);
  }

  if (!columnIndex.has("name")) {
    return {
      rows: [],
      errors: [{ line: 1, message: "ヘッダに name（名前）列が見つかりません" }],
      recognizedColumns: [...columnIndex.keys()],
    };
  }

  const rows: CharacterCsvRow[] = [];
  const errors: RowError[] = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const line = rowIndex + 1;
    const cells = table[rowIndex];
    const read = (column: keyof CharacterCsvRow): string => {
      const index = columnIndex.get(column);
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };

    const name = read("name");
    if (name === "") {
      errors.push({ line, message: "名前が空です" });
      continue;
    }

    const monsterNo = read("monster_no");
    if (monsterNo !== "" && !/^\d+$/.test(monsterNo)) {
      errors.push({ line, message: `図鑑Noが数値ではありません: ${monsterNo}` });
      continue;
    }

    const rarity = read("rarity").replace(/[★☆]/g, "");
    if (rarity !== "" && !(/^\d$/.test(rarity) && Number(rarity) >= 1 && Number(rarity) <= MAX_RARITY)) {
      errors.push({ line, message: `レア度が 1〜${MAX_RARITY} の数値ではありません: ${read("rarity")}` });
      continue;
    }

    rows.push({
      monster_no: monsterNo,
      name,
      name_kana: read("name_kana"),
      family_key: read("family_key"),
      form: read("form"),
      element: read("element"),
      rarity,
      series: read("series"),
    });
  }

  return { rows, errors, recognizedColumns: [...columnIndex.keys()] };
}
