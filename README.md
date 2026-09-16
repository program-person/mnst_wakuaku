# monst-fruit-manager

モンスターストライクの「わくわくの実」を、同キャラを複数体持っているときに**被らないように**管理するWebアプリ。

個人用ツールとして運用している。新規登録は受け付けず、検索エンジンにも載せない。

## 何ができるか

- 所持個体（同キャラ◯体目）ごとに、英雄の証の枠数・装着している実（種類＋等級）を記録する
- 実の装着はグリッドから2タップ（種類 → 等級）。同キャラの他個体が既に持っている実は赤く表示される
- 「被りチェック」で、同キャラ複数体が同じ実を持っている組み合わせを一覧できる
- 実の種類ごとに「被りNG / 被りOK / 被り推奨」の方針を持ち、設定画面でユーザーごとに上書きできる
- 図鑑に載っていないコラボキャラは、`/characters/bulk` に名前を並べて貼り付ければまとめて登録できる（形態・属性・レア度・通称は任意）
- キャラ検索はひらがな・カタカナ・全角半角・記号の違いを吸収する。通称（別名）でも引け、空白区切りで絞り込める
- 所持キャラ一覧を属性・レア度・役割・空きスロット・被り、実の有無で絞り込める。「同キャラの誰も持っていない」＋「空きスロットあり」で、被らずに付けられる個体だけが残る
- 付け替え・取り外しは `fruit_events` に履歴が残る

## 技術スタック

- Next.js 16 (App Router, Server Actions, Proxy) + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth + RLS)。クライアントは `@supabase/ssr`
- デプロイ: Vercel（関数は東京リージョン `hnd1`）

## セットアップ

```powershell
npm install
Copy-Item .env.example .env.local
# .env.local に Supabase の URL と publishable key を記入
npm run dev
```

DBスキーマは `supabase/migrations/` にある。Supabase ダッシュボードの SQL Editor で順に実行するか、Supabase CLI でリンクして `supabase db push` する。

アプリに新規登録画面は無い。自分で動かす場合は、Supabase ダッシュボードの Authentication → Users からユーザーを作成してログインする。

## デプロイ

`main` に push すると Vercel が本番に自動デプロイする。環境変数は Vercel 側に登録済み（Production / Development）。

```powershell
npx vercel env ls
```

Supabase の Authentication → URL Configuration の Site URL は本番 URL にしておく（確認メールのリンク先になる）。

## キャラアイコンの取り込み

個人利用の範囲で、MONST DICTIONARY から獣神化以上の形態のアイコンと、図鑑No・名前・形態・属性・同キャラキーを取り込むスクリプトがある。画像は Supabase の非公開バケットに置き、ログイン中の本人にだけ配信する。

- 自分の PC で実行する。サーバー負荷を避けるため、リクエストは既定で20秒以上の間隔を空ける（下限10秒）
- 403 / 429 / 503 が返ったら即停止する。Ctrl+C で止めても `.crawl-state/` から続きを再開できる
- 同じ系統のページは1回しか取らない。アイコンは ETag で変更の有無を確認し、変わったものだけ取り直す
- キャラマスタに既にある図鑑No は名前などを上書きせず、属性とレア度が空欄のときだけ埋める
- 図鑑にレア度は載っていないため、獣神化系の形態は★6として登録する（前提。要検証）
- 開始時に予想時間と終了予定時刻、各ページで残り時間、終了時にまとめと全体の残りの目安を表示する

```powershell
# .env.local に SUPABASE_SECRET_KEY を追加してから、リポジトリ直下で実行する
node --env-file=.env.local scripts/dictionary/crawl.mts --dry-run --limit=2
node --env-file=.env.local scripts/dictionary/crawl.mts --limit=50
# 読み取る項目を増やしたあと、処理済みページを取り直して補完する
node --env-file=.env.local scripts/dictionary/crawl.mts --revisit-done
```

Windows PowerShell では `npm run crawl:dictionary -- --limit=50` の `--` が消えてオプションが渡らないので、node で直接実行する。

取得した画像や状態ファイルはリポジトリに入れない（`.crawl-state/` は gitignore 済み）。

## データモデル

| テーブル | 役割 |
|---|---|
| `fruit_types` | 実の種類マスタ。効果範囲（自身 / パーティ）、重複可否、被り方針の既定値 |
| `fruit_ranks` | 等級マスタ（2級 〜 特級EL） |
| `characters` | キャラマスタ（全ユーザー共有）。`family_key` で形態違いを同キャラ扱い。検索用の正規化列を自動生成 |
| `character_aliases` | キャラの通称。検索でのみ使う |
| `owned_monsters` | 所持個体。`copy_label` で◯体目を区別。枠数・ラック・役割タグ・メモ |
| `equipped_fruits` | 個体 × スロット × 実 × 等級 |
| `fruit_events` | 装着・取り外し・置換などの履歴 |
| `user_settings` | 同キャラ判定モード（family / character） |
| `user_fruit_policies` | ユーザーごとの被り方針の上書き |
| `v_fruit_duplicates`（view） | 被り検出。方針を反映済み |
| `search_characters()`（関数） | 表記ゆれを吸収したキャラ検索。正規化は `normalize_search_text()` に集約 |

## 設計メモ

- 「被り」は実の種類ごとに意味が違う。パーティ内で最高等級1つしか効かない実（学び・荒稼ぎ・将命削りなど）や絆系は既定で「被りNG」、自身にしか効かない実（友撃・速必殺・ケガ減りなど）は「被りOK」にしている。要検証の解釈なので、マスタの値を直せば挙動が変わる
- キャラマスタは手入力で育てる。wikiや公式サイトからの一括取得は利用規約の確認が要るため未実装。CSVインポート口を用意する予定
- Supabase の型は `src/lib/supabase/database.types.ts`。スキーマ変更後は再生成する

## 今後

- [x] 個体の複製（「＋ もう1体」で◯体目を自動採番。実はコピーしない）
- [x] キャラマスタの CSV インポート / エクスポート（`/characters`。UTF-8 / Shift_JIS 自動判別、日本語ヘッダ可、図鑑Noで upsert）
- [x] 所持データ（個体・実・等級）の CSV インポート / エクスポート（`/monsters/import`、`/monsters/export`。エクスポートした形式をそのまま再取り込み可）
- [x] 被り方針のユーザー上書きUI、同キャラ判定モードの切り替えUI（`/settings`）
- [x] PWA 対応（ホーム画面に追加して単独アプリとして起動。オフライン対応は無し）
- [x] Vercel デプロイ
- [x] キャラアイコン（MONST DICTIONARY から個人利用の範囲で取り込み、アイコンが無いキャラは属性色で代替表示）
- [ ] スクショからの OCR 入力
