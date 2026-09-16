/**
 * 形態（進化段階）の扱い。取り込みスクリプトと画面の両方から使うので、外部依存を持たせない。
 */

/** 獣神化系の形態のレア度。図鑑にレア度が載っていないため、形態から決める（前提: 獣神化系は★6） */
export const EVOLVED_FORM_RARITY = 6;

/** よく使う形態。まとめて登録の既定値と選択肢に使う */
export const COMMON_FORMS = ["獣神化", "獣神化・改", "真獣神化", "神化", "進化"] as const;

/** 半角中黒「･」などを NFKC で揃え、空白を除く（例: 獣神化･改 → 獣神化・改） */
export function normalizeFormLabel(label: string): string {
  return label.normalize("NFKC").replace(/\s+/g, "");
}

/**
 * 獣神化以上の形態か。獣神化・獣神化改・真獣神化（枝分かれの 1 / 2 を含む）が対象。
 * 「獣神化前」「真獣神化前」はその一歩手前の姿なので対象外。
 */
export function isEvolvedForm(label: string): boolean {
  const normalized = normalizeFormLabel(label);
  return normalized.includes("獣神化") && !normalized.endsWith("前");
}

/** 形態からレア度を推定する。分からない形態は null（無理に埋めない） */
export function inferRarity(label: string): number | null {
  return isEvolvedForm(label) ? EVOLVED_FORM_RARITY : null;
}
