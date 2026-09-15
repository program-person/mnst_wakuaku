import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const LIST_LIMIT = 100;

type CharactersPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CharactersPage({ searchParams }: CharactersPageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();

  const countResult = await supabase.from("characters").select("*", { count: "exact", head: true });
  if (countResult.error) throw new Error(`件数の取得に失敗しました: ${countResult.error.message}`);
  const total = countResult.count ?? 0;

  let request = supabase
    .from("characters")
    .select("id, monster_no, name, name_kana, family_key, form, element, rarity, series, source")
    .order("monster_no", { ascending: true, nullsFirst: false })
    .order("id")
    .limit(LIST_LIMIT);
  if (query !== "") {
    const safe = query.replace(/[%,()]/g, "");
    request = /^\d+$/.test(safe)
      ? request.eq("monster_no", Number(safe))
      : request.or(`name.ilike.%${safe}%,name_kana.ilike.%${safe}%,family_key.ilike.%${safe}%`);
  }
  const { data: characters, error } = await request;
  if (error) throw new Error(`キャラマスタの取得に失敗しました: ${error.message}`);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">← ホーム</Link>
          <h1 className="text-2xl font-bold">キャラマスタ</h1>
          <p className="text-sm text-zinc-500">登録数 {total}</p>
        </div>
        <div className="flex gap-2">
          <a href="/characters/export" download className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            CSV エクスポート
          </a>
          <Link href="/characters/import" className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            CSV インポート
          </Link>
        </div>
      </header>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="名前 / かな / 図鑑No"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">検索</button>
      </form>

      {characters.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {query === "" ? "まだキャラがありません。CSV インポートから始めてください。" : "該当するキャラがありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">No</th>
                <th className="px-3 py-2">名前</th>
                <th className="px-3 py-2">形態</th>
                <th className="px-3 py-2">属性</th>
                <th className="px-3 py-2">★</th>
                <th className="px-3 py-2">同キャラキー</th>
                <th className="px-3 py-2">出所</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {characters.map((character) => (
                <tr key={character.id}>
                  <td className="px-3 py-2 text-zinc-500">{character.monster_no ?? "-"}</td>
                  <td className="px-3 py-2 font-medium">
                    {character.name}
                    {character.name_kana ? <span className="ml-1 text-xs text-zinc-500">{character.name_kana}</span> : null}
                  </td>
                  <td className="px-3 py-2">{character.form ?? ""}</td>
                  <td className="px-3 py-2">{character.element ?? ""}</td>
                  <td className="px-3 py-2">{character.rarity ?? ""}</td>
                  <td className="px-3 py-2 text-zinc-500">{character.family_key !== character.name ? character.family_key : ""}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{character.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {characters.length === LIST_LIMIT ? (
            <p className="px-3 py-2 text-xs text-zinc-500">先頭 {LIST_LIMIT} 件のみ表示。検索で絞り込んでください。</p>
          ) : null}
        </div>
      )}
    </main>
  );
}
