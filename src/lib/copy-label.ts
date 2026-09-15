/**
 * 同キャラの既存ラベル（"1","2","3" など）から次のラベルを決める。
 * 数字として読めるラベルの最大値 + 1。数字が1つも無ければ個体数 + 1。
 */
export function nextCopyLabel(existingLabels: string[]): string {
  const numericLabels = existingLabels
    .map((label) => Number.parseInt(label.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (numericLabels.length === 0) {
    return String(existingLabels.length + 1);
  }
  return String(Math.max(...numericLabels) + 1);
}
