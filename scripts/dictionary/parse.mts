/**
 * MONST DICTIONARY（dic.xflag.com）のサイトマップとキャラページを読み取る純粋関数。
 * 通信はしない。ページ構造が変わったら、ここだけ直せば済むようにしている。
 */
import { inferRarity, isEvolvedForm, normalizeFormLabel } from "../../src/lib/monst-forms.ts";

// 形態の判定とレア度の推定は画面側と共通のものを使う
export { inferRarity, normalizeFormLabel };
/** アイコンを取る対象の形態か（＝獣神化以上） */
export const isIconTargetForm = isEvolvedForm;

export const DICTIONARY_ORIGIN = "https://dic.xflag.com";
const CHARACTER_PATH_PATTERN = /\/monsterstrike\/character\/(\d+)\/?$/;

/** サイトマップ索引から子サイトマップの URL を取り出す */
export function parseSitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

/** サイトマップからキャラページの番号を取り出す（重複除去・昇順）。ボス版などの派生ページは除く */
export function parseCharacterPageNumbers(xml: string): number[] {
  const numbers = new Set<number>();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const path = match[1].trim().replace(DICTIONARY_ORIGIN, "");
    const numberMatch = path.match(CHARACTER_PATH_PATTERN);
    if (numberMatch) numbers.add(Number(numberMatch[1]));
  }
  return [...numbers].sort((a, b) => a - b);
}

/** 形態ごとの図鑑No・正式名（例: 聖炎の女神アグナムート）・進化段階ラベル・属性 */
export type DictionaryForm = { monsterNo: number; name: string; label: string; element: string | null };
/** name はページのベース名（例: アグナムート）。同キャラキーに使う */
export type DictionaryPage = { pageNo: number; name: string; forms: DictionaryForm[] };

/** 進化段階のラベル。これ以外（関連キャラ・イベント等）は形態として扱わない */
const FORM_LABEL_PATTERN = /^(進化前|進化|神化|獣神化.*|真獣神化.*)$/;
const KNOWN_ELEMENTS = new Set(["火", "水", "木", "光", "闇"]);

function normalizeElement(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const element = value.trim();
  return KNOWN_ELEMENTS.has(element) ? element : null;
}

/** 正式名に改行（\r\n）が混ざることがあるので空白1つに畳む */
function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

type EmbeddedVariant = { id?: unknown; name?: unknown; element?: unknown; variant?: unknown };
type EmbeddedPageProps = { data?: { name_def?: unknown; name?: unknown }; variantData?: unknown };

/**
 * ページに埋め込まれた構造化データ（__NEXT_DATA__）から読む。見た目の HTML より変わりにくいので第一候補にする
 */
function parseEmbeddedData(html: string, pageNo: number): DictionaryPage | null {
  const scriptMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;

  let pageProps: EmbeddedPageProps | undefined;
  try {
    pageProps = (JSON.parse(scriptMatch[1]) as { props?: { pageProps?: EmbeddedPageProps } }).props?.pageProps;
  } catch {
    return null;
  }
  const baseName = pageProps?.data?.name_def ?? pageProps?.data?.name;
  if (typeof baseName !== "string" || baseName.trim() === "" || !Array.isArray(pageProps?.variantData)) return null;

  const forms: DictionaryForm[] = [];
  const seen = new Set<number>();
  for (const variant of pageProps.variantData as EmbeddedVariant[]) {
    const monsterNo = typeof variant.id === "string" && /^\d+$/.test(variant.id) ? Number(variant.id) : null;
    if (monsterNo === null || seen.has(monsterNo) || typeof variant.variant !== "string") continue;
    const label = normalizeFormLabel(variant.variant);
    if (!FORM_LABEL_PATTERN.test(label)) continue;
    seen.add(monsterNo);
    const name = typeof variant.name === "string" ? normalizeName(variant.name) : "";
    forms.push({ monsterNo, name: name || normalizeName(baseName), label, element: normalizeElement(variant.element) });
  }
  return { pageNo, name: normalizeName(baseName), forms };
}

/** 構造化データが無い場合の予備。形態リンクの画像 alt とラベルから読む（属性は取れない） */
function parseMarkup(html: string, pageNo: number): DictionaryPage | null {
  const titleMatch = html.match(/<title>\s*([^<]+?)のプロフィール\s*[|｜]/);
  if (!titleMatch) return null;
  const name = normalizeName(decodeEntities(titleMatch[1]));
  if (name === "") return null;

  const forms: DictionaryForm[] = [];
  const seen = new Set<number>();
  const linkPattern = /<a[^>]*href="\/monsterstrike\/character\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(linkPattern)) {
    const monsterNo = Number(match[1]);
    const inner = match[2];
    const labelText = [...inner.matchAll(/>([^<>]+)</g)].map((text) => text[1].trim()).find((text) => text !== "");
    if (!labelText || seen.has(monsterNo)) continue;
    const label = normalizeFormLabel(decodeEntities(labelText));
    if (!FORM_LABEL_PATTERN.test(label)) continue;

    const altMatch = inner.match(/alt="([^"]*)"/);
    const formName = altMatch ? normalizeName(decodeEntities(altMatch[1])) : "";
    seen.add(monsterNo);
    forms.push({ monsterNo, name: formName || name, label, element: null });
  }
  return { pageNo, name, forms };
}

/** キャラページから名前と形態一覧を読む。読めなければ null */
export function parseCharacterPage(html: string, pageNo: number): DictionaryPage | null {
  const embedded = parseEmbeddedData(html, pageNo);
  if (embedded && embedded.forms.length > 0) return embedded;
  return parseMarkup(html, pageNo);
}

export function iconUrl(monsterNo: number): string {
  return `${DICTIONARY_ORIGIN}/monsterstrike/assets-update/img/monster/${monsterNo}/ball.png`;
}

export function pageUrl(pageNo: number): string {
  return `${DICTIONARY_ORIGIN}/monsterstrike/character/${pageNo}/`;
}
