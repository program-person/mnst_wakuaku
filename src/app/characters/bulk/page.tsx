import Link from "next/link";
import { BulkCharacterForm } from "@/components/bulk-character-form";

export default function BulkCharactersPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/characters" className="text-sm text-zinc-500 hover:underline">← キャラマスタ</Link>
        <h1 className="text-2xl font-bold">まとめて登録</h1>
        <p className="text-sm text-zinc-500">図鑑に載っていないコラボキャラ用。名前だけ並べれば登録できます。</p>
      </header>

      <section className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>1行1キャラ。名前の後ろは、書いた分だけ使います。区切りはカンマ・タブどちらでも構いません。</p>
        <pre className="overflow-x-auto rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
名前, 形態, 属性, レア度, 通称|通称
        </pre>
        <ul className="list-disc space-y-1 pl-5">
          <li>形態を省くと、下の選択に合わせます</li>
          <li>レア度を省くと、獣神化以上は★6として登録します</li>
          <li>同じ名前と形態のキャラが既にあれば、そのままにします（二重登録されません）</li>
          <li>先頭が # の行と空行は無視します</li>
          <li>アイコンは付きません。属性を書いておくと、一覧で属性色の丸として表示されます</li>
        </ul>
      </section>

      <BulkCharacterForm />
    </main>
  );
}
