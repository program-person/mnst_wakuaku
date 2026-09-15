/**
 * 依存なしの最小CSVパーサ。RFC 4180 相当（ダブルクォート内のカンマ・改行・"" エスケープ）に対応。
 * 行末は CRLF / LF どちらも可。空行は捨てる。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => !(cells.length === 1 && cells[0].trim() === ""));
}

/** 1行をCSV形式にエンコードする（必要なセルだけクォート） */
export function toCsvLine(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((cell) => {
      const value = cell === null || cell === undefined ? "" : String(cell);
      return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    })
    .join(",");
}

/** ヘッダや入力値の比較用正規化。全角英数を半角に（NFKC）、BOM・前後空白を除去、小文字化 */
export function normalizeToken(value: string): string {
  return value.replace(/^﻿/, "").normalize("NFKC").trim().toLowerCase();
}

/**
 * ヘッダ行から「列キー → 列番号」を作る。aliases の各候補と正規化して比較する。
 * 見つからない列はマップに含まれない。
 */
export function resolveColumns<Key extends string>(
  headerRow: string[],
  aliases: Record<Key, readonly string[]>,
): Map<Key, number> {
  const header = headerRow.map(normalizeToken);
  const columns = new Map<Key, number>();
  for (const key of Object.keys(aliases) as Key[]) {
    const candidates = aliases[key].map(normalizeToken);
    const index = header.findIndex((cell) => candidates.includes(cell));
    if (index >= 0) columns.set(key, index);
  }
  return columns;
}

export type RowError = { line: number; message: string };

export type DetectedEncoding = "utf-8" | "shift_jis";

/**
 * UTF-8（BOM有無問わず）として読めればそれを使い、壊れていれば Shift_JIS として読む。
 * Windows の Excel が既定で書き出す「CSV (コンマ区切り)」は Shift_JIS のため。
 */
export function decodeCsvBytes(bytes: Uint8Array): { text: string; encoding: DetectedEncoding } {
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    return { text, encoding: "utf-8" };
  } catch {
    const text = new TextDecoder("shift_jis").decode(bytes);
    return { text, encoding: "shift_jis" };
  }
}
