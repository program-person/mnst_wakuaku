import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addCharacterAlias, deleteCharacterAlias } from "./actions";

export default async function CharacterPage({ params, searchParams }: PageProps<"/characters/[id]">) {
  const { id } = await params;
  const { error: errorParam } = await searchParams;
  const error = typeof errorParam === "string" ? errorParam : undefined;
  if (!/^\d+$/.test(id)) notFound();

  const supabase = await createClient();
  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("id, monster_no, name, name_kana, family_key, form, element, rarity, series, source, character_aliases(id, alias)")
    .eq("id", Number(id))
    .maybeSingle();
  if (characterError) throw new Error(`キャラの取得に失敗しました: ${characterError.message}`);
  if (!character) notFound();

  const details: { label: string; value: string | number | null }[] = [
    { label: "図鑑No", value: character.monster_no },
    { label: "かな", value: character.name_kana },
    { label: "形態", value: character.form },
    { label: "同キャラキー", value: character.family_key },
    { label: "属性", value: character.element },
    { label: "レア度", value: character.rarity },
    { label: "シリーズ", value: character.series },
    { label: "登録元", value: character.source },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/characters" className="text-sm text-zinc-500 hover:underline">← キャラマスタ</Link>
        <h1 className="text-2xl font-bold">{character.name}</h1>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {details.map((detail) => (
          <div key={detail.label} className="contents">
            <dt className="text-zinc-500">{detail.label}</dt>
            <dd>{detail.value ?? "-"}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">通称・別名</h2>
          <p className="text-xs text-zinc-500">検索でだけ使います。ひらがな・カタカナの違いは自動で吸収されます。</p>
        </div>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
        ) : null}

        {character.character_aliases.length === 0 ? (
          <p className="text-sm text-zinc-500">まだありません。</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {character.character_aliases.map((alias) => (
              <li key={alias.id} className="flex items-center gap-1 rounded-full border border-zinc-300 py-0.5 pr-1 pl-3 text-sm dark:border-zinc-700">
                {alias.alias}
                <form action={deleteCharacterAlias}>
                  <input type="hidden" name="character_id" value={character.id} />
                  <input type="hidden" name="alias_id" value={alias.id} />
                  <button aria-label={`別名「${alias.alias}」を削除`} className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addCharacterAlias} className="flex gap-2">
          <input type="hidden" name="character_id" value={character.id} />
          <input
            name="alias"
            required
            maxLength={50}
            placeholder="例: ルシ"
            aria-label="追加する別名"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            追加
          </button>
        </form>
      </section>
    </main>
  );
}
