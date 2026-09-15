import Link from "next/link";
import { CharacterPicker } from "@/components/character-picker";
import { createOwnedMonster } from "../actions";

type NewMonsterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950";

export default async function NewMonsterPage({ searchParams }: NewMonsterPageProps) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/monsters" className="text-sm text-zinc-500 hover:underline">← 所持キャラ</Link>
        <h1 className="text-2xl font-bold">個体を追加</h1>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={createOwnedMonster} className="space-y-5">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">キャラ</h2>
          <CharacterPicker />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block space-y-1 text-sm">
            <span>何体目</span>
            <input name="copy_label" defaultValue="1" className={inputClass} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>実の枠数</span>
            <select name="hero_seal_slots" defaultValue="3" className={inputClass}>
              <option value="0">0（証なし）</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4（大英雄の書）</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>ラック</span>
            <input name="luck" type="number" min={0} max={99} className={inputClass} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>役割タグ</span>
            <input name="role_tag" placeholder="高難度 / 周回 など" className={inputClass} />
          </label>
        </section>

        <label className="block space-y-1 text-sm">
          <span>メモ</span>
          <textarea name="memo" rows={2} className={inputClass} />
        </label>

        <button className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
          登録して実を装着する
        </button>
      </form>
    </main>
  );
}
