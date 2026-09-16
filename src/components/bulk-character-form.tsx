"use client";

import { useActionState, useState } from "react";
import { importBulkCharacters } from "@/app/characters/bulk/actions";
import { INITIAL_IMPORT_STATE } from "@/lib/import-state";
import { COMMON_FORMS } from "@/lib/monst-forms";

const PLACEHOLDER = `孫悟空
ベジータ, 獣神化・改, 闇
フリーザ, 獣神化, 光, 6, フリ`;

/** 空行とコメント行を除いた実際の行数。貼り付けた量をその場で確認できるようにする */
function countEntries(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim() !== "" && !line.trim().startsWith("#")).length;
}

export function BulkCharacterForm() {
  const [state, formAction, isPending] = useActionState(importBulkCharacters, INITIAL_IMPORT_STATE);
  const [lines, setLines] = useState("");
  const entryCount = countEntries(lines);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block space-y-1 text-sm">
          <span>キャラ名（1行に1つ）</span>
          <textarea
            name="lines"
            value={lines}
            onChange={(event) => setLines(event.target.value)}
            rows={12}
            required
            placeholder={PLACEHOLDER}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="space-y-1 text-sm">
            <span className="block text-xs text-zinc-500">形態を書かなかった行の既定</span>
            <select
              name="default_form"
              defaultValue={COMMON_FORMS[0]}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {COMMON_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">{entryCount} 行</span>
            <button
              disabled={isPending || entryCount === 0}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {isPending ? "登録中…" : "まとめて登録"}
            </button>
          </div>
        </div>
      </form>

      {state.status === "error" ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      {state.status === "done" ? (
        <section className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <h2 className="font-semibold">登録しました</h2>
          <table className="text-sm">
            <tbody>
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
