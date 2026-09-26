-- Applied via MCP apply_migration (name: split_dictionary_id)
-- monster_no に入れていた MONST DICTIONARY のページ番号は、ゲーム内の図鑑No とは別物だった
-- （例: 6682 は図鑑サイトでは三炎の女神アグナムート、ゲーム内図鑑ではラプンツェル）。
-- 図鑑サイトの番号は dictionary_id に分け、monster_no はゲーム内の図鑑No 専用にする。

alter table public.characters add column dictionary_id integer;
comment on column public.characters.dictionary_id is 'MONST DICTIONARY（dic.xflag.com）のページ番号。ゲーム内の図鑑No とは一致しない';
comment on column public.characters.monster_no is 'ゲーム内の図鑑No。分からなければ空';
create unique index characters_dictionary_id_key on public.characters (dictionary_id) where dictionary_id is not null;

-- 図鑑サイトから取り込んだキャラの番号を移す（値は失わない。戻すときは逆向きに同じ更新をする）
update public.characters
set dictionary_id = monster_no, monster_no = null
where source = 'dictionary' and monster_no is not null;

-- CSV 取り込み: dictionary_id がある行は、まずそれで既存キャラを特定して更新する。
-- エクスポート → 図鑑No を書き足す → 取り込み直す、で図鑑No をまとめて埋められるようにするため。
create or replace function public.import_characters(rows jsonb)
returns table (inserted integer, updated integer, aliases_added integer)
language plpgsql
set search_path = ''
as $$
declare
  v_dictionary_updated integer := 0;
  v_upsert_inserted integer := 0;
  v_upsert_updated integer := 0;
  v_plain_inserted integer := 0;
  v_aliases_added integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- 1. 図鑑サイト番号で既存キャラに当たる行: 空欄は既存値を残して更新する
  with parsed as (
    select
      nullif(btrim(t.r->>'dictionary_id'), '')::integer as dictionary_id,
      nullif(btrim(t.r->>'monster_no'), '')::integer as monster_no,
      nullif(btrim(t.r->>'name'), '') as name,
      nullif(btrim(t.r->>'name_kana'), '') as name_kana,
      nullif(btrim(t.r->>'family_key'), '') as family_key,
      nullif(btrim(t.r->>'form'), '') as form,
      nullif(btrim(t.r->>'element'), '') as element,
      nullif(btrim(t.r->>'rarity'), '')::smallint as rarity,
      nullif(btrim(t.r->>'series'), '') as series,
      t.ordinality
    from jsonb_array_elements(rows) with ordinality as t(r, ordinality)
  ),
  matched as (
    select distinct on (c.id) c.id as character_id, p.*
    from parsed p
    join public.characters c on c.dictionary_id = p.dictionary_id
    where p.dictionary_id is not null
    order by c.id, p.ordinality desc
  ),
  changed as (
    update public.characters c set
      -- 他のキャラが既にその図鑑No を持っていたら、一意制約で全体が失敗しないよう今の値を残す
      monster_no = case
        when m.monster_no is not null
          and not exists (select 1 from public.characters other where other.monster_no = m.monster_no and other.id <> c.id)
        then m.monster_no
        else c.monster_no
      end,
      name = coalesce(m.name, c.name),
      name_kana = coalesce(m.name_kana, c.name_kana),
      family_key = coalesce(m.family_key, c.family_key),
      form = coalesce(m.form, c.form),
      element = coalesce(m.element, c.element),
      rarity = coalesce(m.rarity, c.rarity),
      series = coalesce(m.series, c.series)
    from matched m
    where c.id = m.character_id
    returning 1
  )
  select count(*)::integer into v_dictionary_updated from changed;

  -- 2. 図鑑No がある行（図鑑サイト番号で当たらなかったもの）: 図鑑No で upsert
  with parsed as (
    select
      nullif(btrim(t.r->>'dictionary_id'), '')::integer as dictionary_id,
      nullif(btrim(t.r->>'monster_no'), '')::integer as monster_no,
      btrim(t.r->>'name') as name,
      nullif(btrim(t.r->>'name_kana'), '') as name_kana,
      nullif(btrim(t.r->>'family_key'), '') as family_key_raw,
      nullif(btrim(t.r->>'form'), '') as form,
      nullif(btrim(t.r->>'element'), '') as element,
      nullif(btrim(t.r->>'rarity'), '')::smallint as rarity,
      nullif(btrim(t.r->>'series'), '') as series,
      t.ordinality
    from jsonb_array_elements(rows) with ordinality as t(r, ordinality)
  ),
  remaining as (
    select * from parsed p
    where p.dictionary_id is null
       or not exists (select 1 from public.characters c where c.dictionary_id = p.dictionary_id)
  ),
  deduped as (
    select distinct on (monster_no) *
    from remaining
    where monster_no is not null
    order by monster_no, ordinality desc
  ),
  upserted as (
    insert into public.characters as c
      (monster_no, dictionary_id, name, name_kana, family_key, form, element, rarity, series, source, created_by)
    select d.monster_no, d.dictionary_id, d.name, d.name_kana,
           coalesce(d.family_key_raw,
                    (select existing.family_key from public.characters existing where existing.monster_no = d.monster_no),
                    d.name),
           d.form, d.element, d.rarity, d.series, 'csv', auth.uid()
    from deduped d
    on conflict (monster_no) where monster_no is not null do update set
      name = excluded.name,
      name_kana = coalesce(excluded.name_kana, c.name_kana),
      family_key = excluded.family_key,
      form = coalesce(excluded.form, c.form),
      element = coalesce(excluded.element, c.element),
      rarity = coalesce(excluded.rarity, c.rarity),
      series = coalesce(excluded.series, c.series),
      dictionary_id = coalesce(c.dictionary_id, excluded.dictionary_id),
      source = 'csv'
    returning (xmax = 0) as is_insert
  )
  select count(*) filter (where is_insert)::integer,
         count(*) filter (where not is_insert)::integer
    into v_upsert_inserted, v_upsert_updated
  from upserted;

  -- 3. どちらの番号も無い行: 同名同形態が無ければ追加する
  with parsed as (
    select
      nullif(btrim(t.r->>'dictionary_id'), '')::integer as dictionary_id,
      nullif(btrim(t.r->>'monster_no'), '')::integer as monster_no,
      btrim(t.r->>'name') as name,
      nullif(btrim(t.r->>'name_kana'), '') as name_kana,
      coalesce(nullif(btrim(t.r->>'family_key'), ''), btrim(t.r->>'name')) as family_key,
      nullif(btrim(t.r->>'form'), '') as form,
      nullif(btrim(t.r->>'element'), '') as element,
      nullif(btrim(t.r->>'rarity'), '')::smallint as rarity,
      nullif(btrim(t.r->>'series'), '') as series,
      t.ordinality
    from jsonb_array_elements(rows) with ordinality as t(r, ordinality)
  ),
  plain as (
    insert into public.characters
      (dictionary_id, name, name_kana, family_key, form, element, rarity, series, source, created_by)
    select distinct on (p.name, p.form)
      p.dictionary_id, p.name, p.name_kana, p.family_key, p.form, p.element, p.rarity, p.series, 'csv', auth.uid()
    from parsed p
    where p.monster_no is null
      and (p.dictionary_id is null
           or not exists (select 1 from public.characters c where c.dictionary_id = p.dictionary_id))
      and not exists (
        select 1 from public.characters c
        where c.name = p.name and c.form is not distinct from p.form
      )
    order by p.name, p.form, p.ordinality desc
    returning 1
  )
  select count(*)::integer into v_plain_inserted from plain;

  -- 4. 別名: 図鑑サイト番号 → 図鑑No → 名前＋形態 の順でキャラを特定して紐付ける
  with alias_rows as (
    select
      nullif(btrim(t.r->>'dictionary_id'), '')::integer as dictionary_id,
      nullif(btrim(t.r->>'monster_no'), '')::integer as monster_no,
      btrim(t.r->>'name') as name,
      nullif(btrim(t.r->>'form'), '') as form,
      btrim(a.alias) as alias
    from jsonb_array_elements(rows) as t(r)
    cross join lateral jsonb_array_elements_text(coalesce(t.r->'aliases', '[]'::jsonb)) as a(alias)
    where btrim(a.alias) <> ''
  ),
  added as (
    insert into public.character_aliases (character_id, alias, created_by)
    select distinct on (c.id, public.normalize_search_text(ar.alias)) c.id, ar.alias, auth.uid()
    from alias_rows ar
    join public.characters c
      on (ar.dictionary_id is not null and c.dictionary_id = ar.dictionary_id)
      or (ar.dictionary_id is null and ar.monster_no is not null and c.monster_no = ar.monster_no)
      or (ar.dictionary_id is null and ar.monster_no is null and c.name = ar.name and c.form is not distinct from ar.form)
    where public.normalize_search_text(ar.alias) <> ''
    on conflict (character_id, alias_normalized) do nothing
    returning 1
  )
  select count(*)::integer into v_aliases_added from added;

  return query select v_upsert_inserted + v_plain_inserted, v_upsert_updated + v_dictionary_updated, v_aliases_added;
end;
$$;

revoke execute on function public.import_characters(jsonb) from public, anon;
grant execute on function public.import_characters(jsonb) to authenticated;
