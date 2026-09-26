-- Applied via MCP apply_migration (name: screenshot_icons)
-- ゲーム内図鑑のスクショから切り出したアイコンを登録できるようにする。

alter table public.characters
  add column icon_source text check (icon_source in ('dictionary', 'screenshot')),
  add column icon_brightness real;

comment on column public.characters.icon_source is 'アイコンの出どころ。dictionary = MONST DICTIONARY、screenshot = 自分の図鑑スクショ';
comment on column public.characters.icon_brightness is 'スクショ由来のアイコンの平均輝度（0〜1）。未所持で暗いアイコンを、後から明るいもので差し替える判定に使う';

update public.characters set icon_source = 'dictionary' where icon_path is not null and icon_source is null;

-- スクショ由来のアイコンはアプリ（ログイン中の本人）が保存する。図鑑由来（monster/）は取り込みスクリプトだけが書く
create policy "screenshot icons insertable by authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'character-icons' and name like 'screenshot/%');

create policy "screenshot icons updatable by authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'character-icons' and name like 'screenshot/%')
  with check (bucket_id = 'character-icons' and name like 'screenshot/%');

create policy "screenshot icons deletable by authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'character-icons' and name like 'screenshot/%');
