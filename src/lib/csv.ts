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
