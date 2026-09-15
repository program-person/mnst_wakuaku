/**
 * MONST DICTIONARY から、獣神化以上の形態のアイコンとキャラ情報（図鑑No・名前・形態・属性・レア度・同キャラキー）を取り込む。
 * 個人利用のため、画像は Supabase の非公開バケットに保存する。
 *
 * 実行（リポジトリ直下で）:
 *   node --env-file=.env.local scripts/dictionary/crawl.mts --limit=50
 *   （Windows PowerShell では npm run 経由だと "--" が消えてオプションが渡らないので、node で直接実行する）
 *
 * オプション:
 *   --limit=N          今回処理するキャラページ数の上限（既定: 無制限）
 *   --interval=秒      リクエスト間の最短間隔（既定: 20、下限: 10）。実際はこれに 0〜50% の揺らぎを足す
 *   --dry-run          取得と読み取りだけ行い、DB とストレージには書かない（アイコンも取りに行かない）
 *   --refresh-sitemap  サイトマップを取り直す（新キャラ追加時など）
 *   --revisit-done     処理済みページを取り直す（読み取る項目を増やしたときの補完用。アイコンは変更が無ければ本体を受け取らない）
 *
 * 途中で Ctrl+C しても、処理済みのページは .crawl-state/ に記録されるので続きから再開できる。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DICTIONARY_ORIGIN,
  iconUrl,
  inferRarity,
  isIconTargetForm,
  pageUrl,
  parseCharacterPage,
  parseCharacterPageNumbers,
  parseSitemapIndex,
  type DictionaryForm,
  type DictionaryPage,
} from "./parse.mts";
import {
  estimateRemainingPages,
  estimateSecondsPerPage,
  formatClock,
  formatDuration,
  formatPercent,
  type RunHistory,
} from "./progress.mts";

const STATE_PATH = join(process.cwd(), ".crawl-state", "dictionary.json");
const ICON_BUCKET = "character-icons";
const DEFAULT_INTERVAL_SECONDS = 20;
const MIN_INTERVAL_SECONDS = 10;
const JITTER_RATIO = 0.5;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const USER_AGENT = "monst-fruit-manager-personal/1.0 (personal use, low-rate)";
// これらが返ったら「負荷をかけている / 拒否されている」とみなして即停止する
const STOP_STATUSES = new Set([403, 429, 503]);
// 狭いターミナル（50桁程度）でも折り返さない幅
const RULE = "=".repeat(40);
const THIN_RULE = "-".repeat(40);
const TERMINAL_BELL = "\u0007";

type PageRecord = { status: "done" | "not_found" | "unparsable"; at: string };
type CrawlState = {
  sitemapFetchedAt: string | null;
  pageNumbers: number[];
  pages: Record<string, PageRecord>;
  /** 形態一覧で既に見つかった図鑑No → 見つけたページ番号。同じ系統のページを何度も取りに行かないため */
  coveredBy: Record<string, number>;
  /** 所要時間の予想に使う実績（古い状態ファイルには無い） */
  history?: RunHistory;
};

type Options = {
  limit: number;
  intervalSeconds: number;
  dryRun: boolean;
  refreshSitemap: boolean;
  revisitDone: boolean;
};

class StopCrawl extends Error {}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    limit: Number.POSITIVE_INFINITY,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    dryRun: false,
    refreshSitemap: false,
    revisitDone: false,
  };
  for (const argument of argv) {
    const [key, value] = argument.split("=");
    if (key === "--limit" && /^\d+$/.test(value ?? "")) options.limit = Number(value);
    else if (key === "--interval" && /^\d+$/.test(value ?? "")) options.intervalSeconds = Number(value);
    else if (key === "--dry-run") options.dryRun = true;
    else if (key === "--refresh-sitemap") options.refreshSitemap = true;
    else if (key === "--revisit-done") options.revisitDone = true;
    else throw new Error(`不明なオプションです: ${argument}`);
  }
  if (options.intervalSeconds < MIN_INTERVAL_SECONDS) {
    throw new Error(`--interval は ${MIN_INTERVAL_SECONDS} 秒以上にしてください（相手サーバーへの配慮）`);
  }
  return options;
}

function loadState(): CrawlState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as CrawlState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { sitemapFetchedAt: null, pageNumbers: [], pages: {}, coveredBy: {} };
  }
}

/** 書き込み途中で落ちても壊れないよう、一時ファイルに書いてから置き換える */
function saveState(state: CrawlState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const temporaryPath = `${STATE_PATH}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(state, null, 2));
  renameSync(temporaryPath, STATE_PATH);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** すべての外部リクエストはここを通す。前回から一定時間空くまで待ってから送る */
function createPoliteFetcher(intervalSeconds: number) {
  let lastRequestAt = 0;
  let consecutiveFailures = 0;

  return async function politeFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
    const interval = intervalSeconds * 1000 * (1 + Math.random() * JITTER_RATIO);
    const waitMs = Math.max(0, lastRequestAt + interval - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, ...headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new StopCrawl(`通信エラーが ${MAX_CONSECUTIVE_FAILURES} 回続いたので停止します: ${String(error)}`);
      }
      throw error;
    }

    if (STOP_STATUSES.has(response.status)) {
      throw new StopCrawl(`HTTP ${response.status} が返ったので停止します（${url}）。時間を空けてから再実行してください`);
    }
    if (response.status >= 500) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new StopCrawl(`サーバーエラーが ${MAX_CONSECUTIVE_FAILURES} 回続いたので停止します（HTTP ${response.status}）`);
      }
    } else {
      consecutiveFailures = 0;
    }
    return response;
  };
}

type PoliteFetch = ReturnType<typeof createPoliteFetcher>;

async function fetchSitemapPageNumbers(politeFetch: PoliteFetch): Promise<number[]> {
  const indexResponse = await politeFetch(`${DICTIONARY_ORIGIN}/sitemap.xml`);
  if (!indexResponse.ok) throw new StopCrawl(`サイトマップを取得できません（HTTP ${indexResponse.status}）`);
  const childUrls = parseSitemapIndex(await indexResponse.text());

  const numbers = new Set<number>();
  for (const childUrl of childUrls) {
    const response = await politeFetch(childUrl);
    if (!response.ok) throw new StopCrawl(`サイトマップを取得できません（HTTP ${response.status}: ${childUrl}）`);
    for (const pageNo of parseCharacterPageNumbers(await response.text())) numbers.add(pageNo);
  }
  return [...numbers].sort((a, b) => a - b);
}

function createDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を .env.local に設定してください（--dry-run なら不要）");
  }
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Database = ReturnType<typeof createDatabase>;

/** 個人利用なのでユーザーは1人の前提。複数いる場合は OWNER_USER_ID で指定させる */
async function resolveOwnerUserId(database: Database): Promise<string> {
  if (process.env.OWNER_USER_ID) return process.env.OWNER_USER_ID;
  const { data, error } = await database.auth.admin.listUsers({ perPage: 2 });
  if (error) throw new Error(`ユーザー一覧を取得できません: ${error.message}`);
  if (data.users.length !== 1) throw new Error("ユーザーが1人ではありません。OWNER_USER_ID を .env.local に設定してください");
  return data.users[0].id;
}

type RegisterResult = { added: number; filled: number };

/**
 * 獣神化以上の形態をキャラマスタに登録する。
 * 既にある図鑑No は名前などを上書きせず、属性とレア度が空欄のときだけ埋める（手で直した内容を守る）
 */
async function registerCharacters(
  database: Database,
  page: DictionaryPage,
  forms: DictionaryForm[],
  ownerUserId: string,
): Promise<RegisterResult> {
  const monsterNumbers = forms.map((form) => form.monsterNo);
  const { data: existing, error } = await database
    .from("characters")
    .select("id, monster_no, element, rarity")
    .in("monster_no", monsterNumbers);
  if (error) throw new Error(`キャラマスタの確認に失敗しました: ${error.message}`);

  const existingByNumber = new Map(existing.map((row) => [row.monster_no as number, row]));
  const rows = forms
    .filter((form) => !existingByNumber.has(form.monsterNo))
    .map((form) => ({
      monster_no: form.monsterNo,
      name: form.name,
      form: form.label,
      family_key: page.name,
      element: form.element,
      rarity: inferRarity(form.label),
      source: "dictionary",
      created_by: ownerUserId,
    }));
  if (rows.length > 0) {
    const { error: insertError } = await database.from("characters").insert(rows);
    if (insertError) throw new Error(`キャラマスタへの登録に失敗しました: ${insertError.message}`);
  }

  let filled = 0;
  for (const form of forms) {
    const row = existingByNumber.get(form.monsterNo);
    if (!row) continue;
    const patch: { element?: string; rarity?: number } = {};
    const rarity = inferRarity(form.label);
    if (row.element === null && form.element !== null) patch.element = form.element;
    if (row.rarity === null && rarity !== null) patch.rarity = rarity;
    if (Object.keys(patch).length === 0) continue;
    const { error: updateError } = await database.from("characters").update(patch).eq("id", row.id);
    if (updateError) throw new Error(`No.${form.monsterNo} の属性・レア度の補完に失敗しました: ${updateError.message}`);
    filled += 1;
  }

  return { added: rows.length, filled };
}

type IconResult = "saved" | "unchanged" | "not_found";

async function syncIcon(database: Database, politeFetch: PoliteFetch, monsterNo: number): Promise<IconResult> {
  const { data: character, error } = await database
    .from("characters")
    .select("id, icon_etag")
    .eq("monster_no", monsterNo)
    .single();
  if (error) throw new Error(`No.${monsterNo} のキャラが見つかりません: ${error.message}`);

  // 前回の ETag を送り、変わっていなければ 304 で本体を受け取らない（通信量を減らす）
  const headers: Record<string, string> = character.icon_etag ? { "If-None-Match": character.icon_etag } : {};
  const response = await politeFetch(iconUrl(monsterNo), headers);
  const now = new Date().toISOString();

  if (response.status === 304) {
    await database.from("characters").update({ icon_fetched_at: now }).eq("id", character.id);
    return "unchanged";
  }
  if (response.status === 404) return "not_found";
  if (!response.ok) throw new Error(`No.${monsterNo} のアイコン取得に失敗しました（HTTP ${response.status}）`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const path = `monster/${monsterNo}.png`;
  const { error: uploadError } = await database.storage
    .from(ICON_BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(`No.${monsterNo} のアイコン保存に失敗しました: ${uploadError.message}`);

  const { error: updateError } = await database
    .from("characters")
    .update({ icon_path: path, icon_etag: response.headers.get("etag"), icon_fetched_at: now })
    .eq("id", character.id);
  if (updateError) throw new Error(`No.${monsterNo} のアイコン情報の更新に失敗しました: ${updateError.message}`);
  return "saved";
}

type Totals = {
  pages: number;
  charactersAdded: number;
  charactersFilled: number;
  iconsSaved: number;
  iconsUnchanged: number;
  iconsMissing: number;
};

function isResolved(state: CrawlState, pageNo: number): boolean {
  return Boolean(state.pages[pageNo]) || state.coveredBy[pageNo] !== undefined;
}

function countResolved(state: CrawlState): number {
  return state.pageNumbers.filter((pageNo) => isResolved(state, pageNo)).length;
}

/** 開始時の案内。1行を短く、揃えずに出す（全角文字の幅揃えは環境で崩れるため） */
function printPlan(input: { plannedPages: number; plannedSeconds: number; startedAt: number; options: Options }): void {
  const { options } = input;
  const modes = [options.dryRun ? "dry-run" : "", options.revisitDone ? "処理済みの取り直し" : ""].filter(Boolean);
  console.log(
    [
      RULE,
      ` MONST DICTIONARY 取り込み${modes.length > 0 ? `（${modes.join("・")}）` : ""}`,
      THIN_RULE,
      ` 今回の予定: ${input.plannedPages} ページ`,
      ` 予想時間: 約${formatDuration(input.plannedSeconds)}`,
      ` 終了予定: ${formatClock(new Date(input.startedAt + input.plannedSeconds * 1000))} 頃`,
      ` 間隔: ${options.intervalSeconds} 秒〜`,
      " 中断: Ctrl+C（続きは次回再開）",
      RULE,
    ].join("\n"),
  );
}

/** 終了時のまとめ。終わったことに気づけるよう、ベルを鳴らしてから出す */
function printSummary(input: {
  outcome: string;
  totals: Totals;
  elapsedSeconds: number;
  state: CrawlState;
  secondsPerPage: number;
  dryRun: boolean;
}): void {
  const { totals, state } = input;
  const resolved = countResolved(state);
  const total = state.pageNumbers.length;
  const remainingInSitemap = total - resolved;
  const remainingPages = estimateRemainingPages(remainingInSitemap, resolved, Object.keys(state.pages).length);

  const lines = [
    "",
    RULE,
    ` ${input.outcome}`,
    THIN_RULE,
    ` 実行時間: ${formatDuration(input.elapsedSeconds)}`,
    ` 処理したページ: ${totals.pages}`,
    ` キャラ追加: ${totals.charactersAdded}`,
    ` 属性・レア度の補完: ${totals.charactersFilled}`,
    ` アイコン保存: ${totals.iconsSaved}`,
    ` アイコン変更なし: ${totals.iconsUnchanged}`,
    ` アイコンなし: ${totals.iconsMissing}`,
    THIN_RULE,
    ` 全体の進み: ${resolved} / ${total}（${formatPercent(resolved, total)}）`,
    remainingInSitemap === 0
      ? " 全ページ処理済みです"
      : ` 残りの目安: 約${remainingPages}ページ、約${formatDuration(remainingPages * input.secondsPerPage)}`,
    ` 1ページの目安: ${formatDuration(input.secondsPerPage)}`,
  ];
  if (input.dryRun) lines.push(" dry-run のため進捗は保存していません");
  lines.push(RULE);

  process.stdout.write(TERMINAL_BELL);
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const politeFetch = createPoliteFetcher(options.intervalSeconds);
  const state = loadState();
  const history: RunHistory = (state.history ??= { pagesProcessed: 0, secondsSpent: 0 });
  const database = options.dryRun ? null : createDatabase();
  const ownerUserId = database ? await resolveOwnerUserId(database) : null;
  const startedAt = Date.now();

  let interrupted = false;
  process.on("SIGINT", () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log("\n中断を受け付けました。今のページの処理が終わったら保存して終了します（もう一度押すと即終了）");
  });

  if (options.refreshSitemap || state.pageNumbers.length === 0) {
    console.log("サイトマップを取得します…");
    state.pageNumbers = await fetchSitemapPageNumbers(politeFetch);
    state.sitemapFetchedAt = new Date().toISOString();
    saveState(state);
  }

  const queue = options.revisitDone
    ? state.pageNumbers.filter((pageNo) => state.pages[pageNo]?.status === "done")
    : state.pageNumbers.filter((pageNo) => !isResolved(state, pageNo));

  // 打ち切りは上限とキューの長さだけで決める。予想ページ数で打ち切ると、予想が外れたときに途中で止まってしまう
  const maxPages = Math.min(queue.length, options.limit);
  // 表示用の予想。通常は同系統の形態ページをまとめて片付けるので、未処理件数より実際に取るページは少ない
  const expectedPages = options.revisitDone
    ? maxPages
    : Math.min(estimateRemainingPages(queue.length, countResolved(state), Object.keys(state.pages).length), options.limit);
  const plannedPages = Math.min(expectedPages, maxPages);
  const plannedSeconds = plannedPages * estimateSecondsPerPage(history, options.intervalSeconds, JITTER_RATIO);
  printPlan({ plannedPages, plannedSeconds, startedAt, options });

  const totals: Totals = {
    pages: 0,
    charactersAdded: 0,
    charactersFilled: 0,
    iconsSaved: 0,
    iconsUnchanged: 0,
    iconsMissing: 0,
  };
  let outcome = maxPages === 0 ? "処理するページはありません" : "取り込み完了";

  // dry-run の結果は記録しない（記録すると本番実行でそのページが処理済み扱いになり、取り込まれなくなる）
  const recordProgress = (): void => {
    if (!options.dryRun) saveState(state);
  };

  try {
    for (const pageNo of queue) {
      if (interrupted || totals.pages >= maxPages) break;
      // 同じ実行中に、別ページの形態一覧で既に見つかった番号なら取りに行かない（取り直し時は除く）
      if (!options.revisitDone && state.coveredBy[pageNo] !== undefined) continue;

      const pageStartedAt = Date.now();
      const response = await politeFetch(pageUrl(pageNo));
      const at = new Date().toISOString();
      if (response.status === 404) {
        state.pages[pageNo] = { status: "not_found", at };
        recordProgress();
        continue;
      }
      if (!response.ok) throw new Error(`ページ ${pageNo} の取得に失敗しました（HTTP ${response.status}）`);

      const page = parseCharacterPage(await response.text(), pageNo);
      if (!page) {
        console.warn(`ページ ${pageNo} を読み取れませんでした（ページ構造が変わった可能性）`);
        state.pages[pageNo] = { status: "unparsable", at };
        recordProgress();
        continue;
      }

      const targets = page.forms.filter((form) => isIconTargetForm(form.label));
      if (database && ownerUserId && targets.length > 0) {
        const registered = await registerCharacters(database, page, targets, ownerUserId);
        totals.charactersAdded += registered.added;
        totals.charactersFilled += registered.filled;
        for (const form of targets) {
          if (interrupted) break;
          const result = await syncIcon(database, politeFetch, form.monsterNo);
          if (result === "saved") totals.iconsSaved += 1;
          else if (result === "unchanged") totals.iconsUnchanged += 1;
          else totals.iconsMissing += 1;
        }
      }

      // 形態一覧に出た図鑑No のページは同じ内容なので、以後は取りに行かない
      for (const form of page.forms) state.coveredBy[form.monsterNo] ??= pageNo;
      state.pages[pageNo] = { status: "done", at };
      totals.pages += 1;
      if (!options.dryRun) {
        history.pagesProcessed += 1;
        history.secondsSpent += (Date.now() - pageStartedAt) / 1000;
      }
      recordProgress();

      // 今回の実測の平均で、残り時間と終了時刻を出し直す。予想より多く取ることもあるので分母は大きい方を使う
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const expectedTotal = Math.max(plannedPages, totals.pages);
      const remainingSeconds = (expectedTotal - totals.pages) * (elapsedSeconds / totals.pages);
      const element = targets[0]?.element ?? page.forms[0]?.element ?? "属性不明";
      console.log(
        `[${totals.pages}/約${expectedTotal}] ${page.name}（${element}）対象${targets.length}形態\n` +
          `  経過 ${formatDuration(elapsedSeconds)} / 残り約${formatDuration(remainingSeconds)}` +
          `（${formatClock(new Date(Date.now() + remainingSeconds * 1000))} 頃）`,
      );
    }
    if (interrupted) outcome = "中断しました（続きは次回再開します）";
  } catch (error) {
    recordProgress();
    process.exitCode = error instanceof StopCrawl ? 2 : 1;
    outcome = `停止: ${error instanceof Error ? error.message : String(error)}`;
  }

  printSummary({
    outcome,
    totals,
    elapsedSeconds: (Date.now() - startedAt) / 1000,
    state,
    secondsPerPage: estimateSecondsPerPage(history, options.intervalSeconds, JITTER_RATIO),
    dryRun: options.dryRun,
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
