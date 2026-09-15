import Link from "next/link";
import { ImportForm } from "./import-form";

export default function ImportCharactersPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header>
        <Link href="/characters" className="text-sm text-zinc-500 hover:underline">← キャラマスタ</Link>
        <h1 className="text-2xl font-bold">CSV から取り込む</h1>
      </header>

      <section className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>1行目はヘッダ。列の順番は自由で、英語名と日本語名のどちらでも認識します。</p>
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1 text-left">列</th>
                <th className="px-2 py-1 text-left">別名</th>
                <th className="px-2 py-1 text-left">必須</th>
                <th className="px-2 py-1 text-left">説明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr><td className="px-2 py-1">monster_no</td><td className="px-2 py-1">図鑑No</td><td className="px-2 py-1">-</td><td className="px-2 py-1">あれば同じNoの行を更新（重複登録されない）</td></tr>
              <tr><td className="px-2 py-1">name</td><td className="px-2 py-1">名前 / キャラ名</td><td className="px-2 py-1">✓</td><td className="px-2 py-1"></td></tr>
              <tr><td className="px-2 py-1">name_kana</td><td className="px-2 py-1">かな</td><td className="px-2 py-1">-</td><td className="px-2 py-1">検索用</td></tr>
              <tr><td className="px-2 py-1">family_key</td><td className="px-2 py-1">同キャラキー</td><td className="px-2 py-1">-</td><td className="px-2 py-1">空なら名前と同じ。形態違いを同一視するキー</td></tr>
              <tr><td className="px-2 py-1">form</td><td className="px-2 py-1">形態</td><td className="px-2 py-1">-</td><td className="px-2 py-1">進化 / 神化 / 獣神化 など</td></tr>
              <tr><td className="px-2 py-1">element</td><td className="px-2 py-1">属性</td><td className="px-2 py-1">-</td><td className="px-2 py-1"></td></tr>
              <tr><td className="px-2 py-1">rarity</td><td className="px-2 py-1">レア度</td><td className="px-2 py-1">-</td><td className="px-2 py-1">1〜9 の数字。★は無視</td></tr>
              <tr><td className="px-2 py-1">series</td><td className="px-2 py-1">シリーズ</td><td className="px-2 py-1">-</td><td className="px-2 py-1"></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <a href="/templates/characters_template.csv" download className="underline">テンプレートCSVをダウンロード</a>
        </p>
      </section>

      <ImportForm />
    </main>
  );
}
