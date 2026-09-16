import { splitAliases, type CharacterCsvRow } from "@/lib/character-csv";
import { normalizeToken, type RowError } from "@/lib/csv";
import { inferRarity, normalizeFormLabel } from "@/lib/monst-forms";

/**
 * 「まとめて登録」欄の読み取り。1行1キャラで、名前だけでも登録できる。
 * 区切りはカンマ・タブ・全角カンマ・読点（表計算からの貼り付けをそのまま受けるため）。
 *
 *   名前[, 形態[, 属性[, レア度[, 通称|通称]]]]
 */

const FIELD_SEPARATOR = /[\t,，]/;
const KNOWN_ELEMENTS = ["火", "水", "木", "光", "闇"];
const MAX_RARITY = 9;
const MAX_NAME_LENGTH = 80;

export type ParsedBulkCharacters = { rows: CharacterCsvRow[]; errors: RowError[] };

function isElement(value: string): boolean {
  return KNOWN_ELEMENTS.includes(value);
}

/**
 * 空行とコメント行（#）は無視する。行番号は貼り付けた文のままにして、どの行かを指せるようにする。
 */
export function parseBulkCharacters(text: string, defaultForm: string): ParsedBulkCharacters {
  const rows: CharacterCsvRow[] = [];
  const errors: RowError[] = [];
  // 同じ入力内の重複は最初の行だけ採用する（名前＋形態で判定）
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) return;

    const [namePart, formPart, elementPart, rarityPart, aliasPart] = line.split(FIELD_SEPARATOR).map((part) => part.trim());
    const lineNumber = index + 1;

    const name = namePart ?? "";
    if (name === "") {
      errors.push({ line: lineNumber, message: "名前が空です" });
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      errors.push({ line: lineNumber, message: `名前が長すぎます（${MAX_NAME_LENGTH}文字まで）` });
      return;
    }

    const form = normalizeFormLabel(formPart && formPart !== "" ? formPart : defaultForm);

    const element = elementPart ?? "";
    if (element !== "" && !isElement(element)) {
      errors.push({ line: lineNumber, message: `属性は ${KNOWN_ELEMENTS.join("・")} のどれかにしてください: ${element}` });
      return;
    }

    const rarityText = (rarityPart ?? "").normalize("NFKC").replace(/[★☆]/g, "");
    if (rarityText !== "" && !(/^\d$/.test(rarityText) && Number(rarityText) >= 1 && Number(rarityText) <= MAX_RARITY)) {
      errors.push({ line: lineNumber, message: `レア度は 1〜${MAX_RARITY} の数字にしてください: ${rarityPart}` });
      return;
    }
    // 空欄なら形態から推定する（獣神化系は★6）
    const rarity = rarityText !== "" ? rarityText : (inferRarity(form)?.toString() ?? "");

    const key = `${normalizeToken(name)}|${normalizeToken(form)}`;
    if (seen.has(key)) {
      errors.push({ line: lineNumber, message: `この入力内で重複しています: ${name}（${form}）` });
      return;
    }
    seen.add(key);

    rows.push({
      monster_no: "",
      name,
      name_kana: "",
      // 形態違いをまとめるキー。コラボキャラも形態が増えたときに同じ扱いになる
      family_key: name,
      form,
      element,
      rarity,
      series: "",
      aliases: splitAliases(aliasPart ?? ""),
    });
  });

  return { rows, errors };
}
