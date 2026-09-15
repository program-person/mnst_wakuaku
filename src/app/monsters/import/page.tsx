import Link from "next/link";
import { CsvImportForm } from "@/components/csv-import-form";
import { importOwnedMonsters } from "./actions";

const COLUMN_HELP: { column: string; alias: string; description: string }[] = [
  { column: "monster_no", alias: "図鑑No", description: "キャラの特定に使う。無ければ名前＋形態で探す" },
  { column: "name", alias: "名前", description: "マスタに無ければキャラを自動追加する" },
  { column: "form", alias: "形態", description: "同名キャラが複数あるときの絞り込み" },
  { column: "copy_label", alias: "何体目", description: "空なら 1。同じキャラ＋何体目の個体があれば更新" },
  { column: "hero_seal_slots", alias: "枠数", description: "0〜4。実が枠数より多ければ自動で広げる" },
  { column: "luck", alias: "ラック", description: "0〜99" },
  { column: "role_tag", alias: "役割", description: "高難度 / 周回 など" },
  { column: "memo", alias: "メモ", description: "" },
  { column: "slot1_fruit 〜 slot4_fruit", alias: "実1 〜 実4", description: "実の正式名・略称どちらでも可（例: 同族の絆・加撃 / 同絆撃）" },
  { column: "slot1_rank 〜 slot4_rank", alias: "等級1 〜 等級4", description: "特級L / 特L / 1級M など" },
];

export default function ImportOwnedMonstersPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header>
        <Link href="/monsters" className="text-sm text-zinc-500 hover:underline">← 所持キャラ</Link>
        <h1 className="text-2xl font-bold">所持データを CSV から取り込む</h1>
      </header>

      <section className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          1行 = 1個体。一番楽なのは、先に
          <a href="/monsters/export" download className="mx-1 underline">エクスポート</a>
          したCSVをExcelで編集して戻す方法です。
        </p>
        <p>
          空欄は既存の値を残します。ただし<strong>実の列がヘッダにあってセルが空のスロットは「外す」</strong>扱いです。実に触れたくない場合は実の列ごと消してください。
        </p>
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1 text-left">列</th>
                <th className="px-2 py-1 text-left">別名</th>
                <th className="px-2 py-1 text-left">説明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {COLUMN_HELP.map((help) => (
                <tr key={help.column}>
                  <td className="px-2 py-1 whitespace-nowrap">{help.column}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{help.alias}</td>
                  <td className="px-2 py-1">{help.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CsvImportForm action={importOwnedMonsters} />
    </main>
  );
}
