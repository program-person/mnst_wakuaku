"use client";

import { useActionState } from "react";
import { INITIAL_IMPORT_STATE, type ImportState } from "@/lib/import-state";

type CsvImportFormProps = {
  action: (previous: ImportState, formData: FormData) => Promise<ImportState>;
};

export function CsvImportForm({ action }: CsvImportFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_IMPORT_STATE);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block space-y-1 text-sm">
          <span>CSVファイル（UTF-8 / Shift_JIS どちらも可）</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 dark:file:bg-zinc-800"
          />
        </label>
        <button
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isPending ? "取り込み中…" : "取り込む"}
        </button>
      </form>

      {state.status === "error" ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      {state.status === "done" ? (
        <section className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <h2 className="font-semibold">取り込み完了</h2>
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="pr-4 text-zinc-500">文字コード</td>
                <td>{state.encoding}</td>
              </tr>
              {state.stats.map((stat) => (
                <tr key={stat.label}>
                  <td className="pr-4 text-zinc-500">{stat.label}</td>
                  <td>{stat.value}</td>
                </tr>
              ))}
              <tr>
                <td className="pr-4 text-zinc-500">エラー行</td>
                <td>{state.errorCount}</td>
              </tr>
            </tbody>
          </table>
          {state.errors.length > 0 ? (
            <details open={state.errorCount <= 5}>
              <summary className="cursor-pointer">エラーの内訳（先頭 {state.errors.length} 件）</summary>
              <ul className="mt-1 list-disc pl-5 text-red-700 dark:text-red-300">
                {state.errors.map((error, index) => (
                  <li key={`${error.line}-${index}`}>
                    {error.line}行目: {error.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
