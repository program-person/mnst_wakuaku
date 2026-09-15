/**
 * 取り込みの所要時間の予想と、表示用の整形。通信も状態の保存もしない純粋関数。
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const TIME_ZONE = "Asia/Tokyo";

/** 秒数を「1時間5分」「3分」「40秒」の形にする */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}秒`;
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (hours === 0) return `${minutes}分`;
  return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
}

/** 日本時間の時刻。日付が変わる場合は日付も付ける */
export function formatClock(date: Date, now: Date = new Date()): string {
  const time = date.toLocaleTimeString("ja-JP", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const sameDay =
    date.toLocaleDateString("ja-JP", { timeZone: TIME_ZONE }) === now.toLocaleDateString("ja-JP", { timeZone: TIME_ZONE });
  if (sameDay) return time;
  const day = date.toLocaleDateString("ja-JP", { timeZone: TIME_ZONE, month: "numeric", day: "numeric" });
  return `${day} ${time}`;
}

export type RunHistory = {
  /** これまでの実行で処理したページ数の合計 */
  pagesProcessed: number;
  /** それに掛かった秒数の合計（待ち時間込み） */
  secondsSpent: number;
};

/**
 * 1ページあたりの秒数の見込み。実績があれば実績の平均、無ければ設定から計算する。
 * 設定からの計算は「ページ1回＋アイコン平均3回」を、揺らぎの平均込みの間隔で行う想定。
 */
export function estimateSecondsPerPage(history: RunHistory, intervalSeconds: number, jitterRatio: number): number {
  const MIN_PAGES_FOR_HISTORY = 3;
  const ASSUMED_REQUESTS_PER_PAGE = 4;
  if (history.pagesProcessed >= MIN_PAGES_FOR_HISTORY && history.secondsSpent > 0) {
    return history.secondsSpent / history.pagesProcessed;
  }
  return intervalSeconds * (1 + jitterRatio / 2) * ASSUMED_REQUESTS_PER_PAGE;
}

/**
 * 残りページ数の見込み。1ページ取るとその系統の形態ページもまとめて片付くので、
 * サイトマップ上の未処理件数を「1ページで片付いた件数の平均」で割る。
 */
export function estimateRemainingPages(remainingInSitemap: number, resolvedInSitemap: number, pagesProcessed: number): number {
  if (remainingInSitemap <= 0) return 0;
  if (pagesProcessed === 0 || resolvedInSitemap === 0) return remainingInSitemap;
  const resolvedPerPage = Math.max(1, resolvedInSitemap / pagesProcessed);
  return Math.ceil(remainingInSitemap / resolvedPerPage);
}

export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.floor((part / whole) * 100)}%`;
}
