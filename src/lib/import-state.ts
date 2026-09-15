import type { DetectedEncoding, RowError } from "@/lib/csv";

/** CSV取り込みの結果。キャラマスタ・所持データで共通の形にしてフォームを共有する */
export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      encoding: DetectedEncoding;
      stats: { label: string; value: number }[];
      errors: RowError[];
      errorCount: number;
    };

export const INITIAL_IMPORT_STATE: ImportState = { status: "idle" };

export const MAX_REPORTED_ERRORS = 50;
