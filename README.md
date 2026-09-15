# monst-fruit-manager

モンスターストライクの「わくわくの実」を、同キャラを複数体持っているときに**被らないように**管理するWebアプリ。

## 何ができるか

- 所持個体（同キャラ◯体目）ごとに、英雄の証の枠数・装着している実（種類＋等級）を記録する
- 実の装着はグリッドから2タップ（種類 → 等級）。同キャラの他個体が既に持っている実は赤く表示される
- 「被りチェック」で、同キャラ複数体が同じ実を持っている組み合わせを一覧できる
- 実の種類ごとに「被りNG / 被りOK / 被り推奨」の方針を持ち、ユーザーごとに上書きできる（UIは未実装、`user_fruit_policies`）
- 付け替え・取り外しは `fruit_events` に履歴が残る

## 技術スタック

- Next.js 16 (App Router, Server Actions, Proxy) + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth + RLS)。クライアントは `@supabase/ssr`
- デプロイ想定: Vercel

## セットアップ

```powershell
npm install
Copy-Item .env.example .env.local
# .env.local に Supabase の URL と publishable key を記入
npm run dev
```

DBスキーマは `supabase/migrations/` にある。Supabase ダッシュボードの SQL Editor で順に実行するか、Supabase CLI でリンクして `supabase db push` する。

初回は `/login` の「新規登録」でアカウントを作る。Supabase 側で「Confirm email」が有効なら、確認メールのリンクを開いてからログインする。

## データモデル

| テーブル | 役割 |
|---|---|
| `fruit_types` | 実の種類マスタ。効果範囲（自身 / パーティ）、重複可否、被り方針の既定値 |
| `fruit_ranks` | 等級マスタ（2級 〜 特級EL） |
| `characters` | キャラマスタ（全ユーザー共有）。`family_key` で形態違いを同キャラ扱い |
| `owned_monsters` | 所持個体。`copy_label` で◯体目を区別。枠数・ラック・役割タグ・メモ |
| `equipped_fruits` | 個体 × スロット × 実 × 等級 |
| `fruit_events` | 装着・取り外し・置換などの履歴 |
| `user_settings` | 同キャラ判定モード（family / character） |
| `user_fruit_policies` | ユーザーごとの被り方針の上書き |
| `v_fruit_duplicates`（view） | 被り検出。方針を反映済み |

## 設計メモ

- 「被り」は実の種類ごとに意味が違う。パーティ内で最高等級1つしか効かない実（学び・荒稼ぎ・将命削りなど）や絆系は既定で「被りNG」、自身にしか効かない実（友撃・速必殺・ケガ減りなど）は「被りOK」にしている。要検証の解釈なので、マスタの値を直せば挙動が変わる
- キャラマスタは手入力で育てる。wikiや公式サイトからの一括取得は利用規約の確認が要るため未実装。CSVインポート口を用意する予定
- Supabase の型は `src/lib/supabase/database.types.ts`。スキーマ変更後は再生成する

## 今後

- [x] 個体の複製（「＋ もう1体」で◯体目を自動採番。実はコピーしない）
- [ ] キャラマスタの CSV インポート / エクスポート
- [ ] 被り方針のユーザー上書きUI、同キャラ判定モードの切り替えUI
- [ ] PWA 対応（スマホでプレイ中に開く）
- [ ] スクショからの OCR 入力
