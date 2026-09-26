import Link from "next/link";
import { ScreenshotIconImporter } from "@/components/screenshot-icon-importer";

export default function ImportScreenshotIconsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/characters" className="text-sm text-zinc-500 hover:underline">← キャラマスタ</Link>
        <h1 className="text-2xl font-bold">スクショからアイコン登録</h1>
        <p className="text-sm text-zinc-500">ゲーム内「モンスター図鑑」のスクショから、アイコンと図鑑Noをまとめて登録します。</p>
      </header>

      <section className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <ul className="list-disc space-y-1 pl-5">
          <li>図鑑で作品（コラボ）ごとに絞り込み、No.昇順のまま撮ってください。何枚でも一度に選べます</li>
          <li>画像の処理はこの端末の中で行い、スクショ全体はサーバーに送りません。送るのは切り出したアイコンだけです</li>
          <li>図鑑Noは自動で読み取ります。違っていたら直してください。読めなかったマス（下の段の件数表示に隠れたものなど）は、番号を入れなければ保存されません</li>
          <li>図鑑Noが登録済みのキャラには、そのまま付けます。未登録なら名前を入れてください（まとめて登録で名前だけ入れたキャラにも、同じ名前・形態なら付きます）</li>
          <li>未所持で暗いアイコンも取り込めます。あとで明るいアイコンを取り込むと差し替わります</li>
          <li>公式図鑑から取ったアイコンは残します。置き換えたいときだけチェックを入れてください</li>
        </ul>
      </section>

      <ScreenshotIconImporter />
    </main>
  );
}
