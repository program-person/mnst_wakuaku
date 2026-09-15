/**
 * MONST DICTIONARY（dic.xflag.com）のサイトマップとキャラページを読み取る純粋関数。
 * 通信はしない。ページ構造が変わったら、ここだけ直せば済むようにしている。
 */

export const DICTIONARY_ORIGIN = "https://dic.xflag.com";
const CHARACTER_PATH_PATTERN = /\/monsterstrike\/character\/(\d+)\/?$/;

/** サイトマップ索引から子サイトマップの URL を取り出す */
export function parseSitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

/** サイトマップからキャラページの番号を取り出す（重複除去・昇順） */
export function parseCharacterPageNumbers(xml: string): number[] {
  const numbers = new Set<number>();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = match[1].trim().replace(DICTIONARY_ORIGIN, "");
    const numberMatch = path.match(CHARACTER_PATH_PATTERN);
    if (numberMatch) numbers.add(Number(numberMatch[1]));
  }
  return [...numbers].sort((a, b) => a - b);
}

/** 形態ごとの図鑑No・正式名（例: 聖炎の女神アグナムート）・進化段階ラベル */
export type DictionaryForm = { monsterNo: number; name: string; label: string };
/** name はページのベース名（例: アグナムート）。同キャラキーに使う */
export type DictionaryPage = { pageNo: number; name: string; forms: DictionaryForm[] };

/** 進化段階のラベル。これ以外のリンク（関連キャラ・イベント等）は形態として扱わない */
const FORM_LABEL_PATTERN = /^(進化前|進化|神化|獣神化.*|真獣神化.*)$/;

/** 半角中黒「･」などを NFKC で揃え、空白を除く（例: 獣神化･改 → 獣神化・改） */
export function normalizeFormLabel(label: string): string {
  return label.normalize("NFKC").replace(/\s+/g, "");
}

/** アイコンを取る対象か。獣神化・獣神化改・真獣神化などを対象にし、進化前〜神化は対象外 */
export function isIconTargetForm(label: string): boolean {
  return normalizeFormLabel(label).includes("獣神化");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/**
 * キャラページから名前と形態一覧を読む。読めなければ null。
 * 名前は <title>「◯◯のプロフィール | …」から取る。
 */
export function parseCharacterPage(html: string, pageNo: number): DictionaryPage | null {
  const titleMatch = html.match(/<title>\s*([^<]+?)のプロフィール\s*[|｜]/);
  if (!titleMatch) return null;
  const name = decodeEntities(titleMatch[1]).trim();
  if (name === "") return null;

  const forms: DictionaryForm[] = [];
  const seen = new Set<number>();
  // 形態リンクは <a href=".../character/{No}/"> の中にアイコン画像（alt が正式名）と <p> のラベルを持つ
  const linkPattern = /<a[^>]*href="\/monsterstrike\/character\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(linkPattern)) {
    const monsterNo = Number(match[1]);
    const inner = match[2];
    const labelText = [...inner.matchAll(/>([^<>]+)</g)].map((text) => text[1].trim()).find((text) => text !== "");
    if (!labelText || seen.has(monsterNo)) continue;
    const label = normalizeFormLabel(decodeEntities(labelText));
    if (!FORM_LABEL_PATTERN.test(label)) continue;

    const altMatch = inner.match(/alt="([^"]*)"/);
    // 正式名に改行が混ざることがあるので空白1つに畳む。取れなければページのベース名で代用
    const formName = altMatch ? decodeEntities(altMatch[1]).replace(/\s+/g, " ").trim() : "";
    seen.add(monsterNo);
    forms.push({ monsterNo, name: formName || name, label });
  }

  return { pageNo, name, forms };
}

export function iconUrl(monsterNo: number): string {
  return `${DICTIONARY_ORIGIN}/monsterstrike/assets-update/img/monster/${monsterNo}/ball.png`;
}

export function pageUrl(pageNo: number): string {
  return `${DICTIONARY_ORIGIN}/monsterstrike/character/${pageNo}/`;
}
