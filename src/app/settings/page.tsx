import Link from "next/link";
import { DUPLICATE_POLICY_LABELS, FRUIT_CATEGORY_LABELS, getFruitTypes } from "@/lib/queries/masters";
import {
  DUPLICATE_POLICIES,
  SAME_CHARACTER_MODE_LABELS,
  getDuplicatePolicies,
  getSameCharacterMode,
  type SameCharacterMode,
} from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

const SCOPE_LABELS: Record<string, string> = {
  self: "自身のみ",
  party: "パーティ",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const [mode, fruitTypes] = await Promise.all([getSameCharacterMode(supabase), getFruitTypes(supabase)]);
  const policies = await getDuplicatePolicies(supabase, fruitTypes);
  const categories = [...new Set(fruitTypes.map((type) => type.category))];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← ホーム</Link>
        <h1 className="text-2xl font-bold">設定</h1>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">保存しました</p>
      ) : null}

      <form action={saveSettings} className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-semibold">同キャラの判定</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(SAME_CHARACTER_MODE_LABELS) as SameCharacterMode[]).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200 p-3 has-[:checked]:border-zinc-900 dark:border-zinc-800 dark:has-[:checked]:border-zinc-100"
              >
                <input type="radio" name="same_character_mode" value={value} defaultChecked={mode === value} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{SAME_CHARACTER_MODE_LABELS[value].title}</span>
                  <span className="block text-xs text-zinc-500">{SAME_CHARACTER_MODE_LABELS[value].description}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">実ごとの被り方針</h2>
            <p className="text-xs text-zinc-500">
              「被りNG」の実だけが被りチェックの要対応に出ます。「既定」は初期値で、変えた行は太字になります。
            </p>
          </div>

          {categories.map((category) => (
            <div key={category} className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <caption className="bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-500 dark:bg-zinc-900">
                  {FRUIT_CATEGORY_LABELS[category] ?? category}
                </caption>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {fruitTypes
                    .filter((type) => type.category === category)
                    .map((type) => {
                      const current = policies[type.id];
                      const isOverridden = current !== type.default_duplicate_policy;
                      return (
                        <tr key={type.id}>
                          <td className={`px-3 py-2 ${isOverridden ? "font-bold" : ""}`}>{type.name}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap text-zinc-500">
                            {SCOPE_LABELS[type.effect_scope] ?? type.effect_scope}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <select
                              name={`policy_${type.id}`}
                              defaultValue={current}
                              aria-label={`${type.name} の被り方針`}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                            >
                              {DUPLICATE_POLICIES.map((policy) => (
                                <option key={policy} value={policy}>
                                  {DUPLICATE_POLICY_LABELS[policy]}
                                  {policy === type.default_duplicate_policy ? "（既定）" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <div className="sticky bottom-0 -mx-6 border-t border-zinc-200 bg-white/90 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <button className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            保存
          </button>
        </div>
      </form>
    </main>
  );
}
