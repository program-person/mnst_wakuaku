import Link from "next/link";
import { DUPLICATE_POLICY_LABELS } from "@/lib/queries/masters";
import { listFruitDuplicates } from "@/lib/queries/owned-monsters";
import { createClient } from "@/lib/supabase/server";

export default async function DuplicatesPage() {
  const supabase = await createClient();
  const duplicates = await listFruitDuplicates(supabase);
  const flagged = duplicates.filter((row) => row.duplicate_policy === "avoid");
  const tolerated = duplicates.filter((row) => row.duplicate_policy !== "avoid");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← ホーム</Link>
        <h1 className="text-2xl font-bold">被りチェック</h1>
        <p className="text-sm text-zinc-500">同キャラの複数体が同じ実を持っている組み合わせ</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-semibold text-red-700 dark:text-red-300">要対応（被りNGの実）{flagged.length}件</h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-zinc-500">被りはありません 🎉</p>
        ) : (
          <DuplicateTable rows={flagged} />
        )}
      </section>

      {tolerated.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold text-zinc-500">参考（被りOK / 推奨の実）{tolerated.length}件</h2>
          <DuplicateTable rows={tolerated} />
        </section>
      ) : null}
    </main>
  );
}

type Row = Awaited<ReturnType<typeof listFruitDuplicates>>[number];

function DuplicateTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2">キャラ</th>
            <th className="px-3 py-2">実</th>
            <th className="px-3 py-2">方針</th>
            <th className="px-3 py-2">持っている個体</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={`${row.group_key}-${row.fruit_type_id}`}>
              <td className="px-3 py-2 font-medium">{row.character_name}</td>
              <td className="px-3 py-2">{row.fruit_name}</td>
              <td className="px-3 py-2 text-xs">{DUPLICATE_POLICY_LABELS[row.duplicate_policy ?? ""] ?? row.duplicate_policy}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  {(row.owned_monster_ids ?? []).map((id, index) => (
                    <Link key={id} href={`/monsters/${id}`} className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                      {row.copy_labels?.[index] ?? "?"}体目
                    </Link>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
