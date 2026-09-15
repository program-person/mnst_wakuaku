-- Applied via MCP apply_migration (name: character_icons)
-- キャラアイコン（個人利用のため非公開ストレージに保存）。

alter table public.characters
  add column icon_path text,
  add column icon_etag text,
  add column icon_fetched_at timestamptz;

comment on column public.characters.icon_path is 'character-icons バケット内のパス。null ならアイコンなし';
comment on column public.characters.icon_etag is '取得元の ETag。再取得時に変更の有無を判定する';

-- 非公開バケット。public = false なので URL を知っていても未ログインでは読めない
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('character-icons', 'character-icons', false, 1048576, array['image/png', 'image/webp'])
on conflict (id) do nothing;

-- 読み取りはログインユーザーのみ。書き込みはポリシーを作らず、秘密鍵を使う取得スクリプトだけが行う
create policy "character icons readable by authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'character-icons');
