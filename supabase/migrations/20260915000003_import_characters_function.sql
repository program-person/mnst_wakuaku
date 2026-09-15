-- Applied via MCP apply_migration (name: import_characters_function)
-- CSV取り込み用。1回の呼び出しで複数行を upsert する。
-- monster_no がある行は monster_no で upsert、無い行は (name, form) が未登録のときだけ insert。
create or replace function public.import_characters(rows jsonb)
returns table (inserted integer, updated integer)
language plpgsql
set search_path = ''
as $$
declare
  v_upsert_inserted integer := 0;
  v_upsert_updated integer := 0;
  v_plain_inserted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  with parsed as (
    select
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
  deduped as (
    -- 同じ図鑑Noがファイル内に複数あれば後の行を採用
    select distinct on (monster_no) *
    from parsed
    where monster_no is not null
    order by monster_no, ordinality desc
  ),
  upserted as (
    insert into public.characters as c
      (monster_no, name, name_kana, family_key, form, element, rarity, series, source, created_by)
    select monster_no, name, name_kana, family_key, form, element, rarity, series, 'csv', auth.uid()
    from deduped
    on conflict (monster_no) where monster_no is not null do update set
      name = excluded.name,
      name_kana = coalesce(excluded.name_kana, c.name_kana),
      family_key = excluded.family_key,
      form = coalesce(excluded.form, c.form),
      element = coalesce(excluded.element, c.element),
      rarity = coalesce(excluded.rarity, c.rarity),
      series = coalesce(excluded.series, c.series),
      source = 'csv'
    returning (xmax = 0) as is_insert
  )
  select count(*) filter (where is_insert)::integer,
         count(*) filter (where not is_insert)::integer
    into v_upsert_inserted, v_upsert_updated
  from upserted;

  with parsed as (
    select
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
      (name, name_kana, family_key, form, element, rarity, series, source, created_by)
    select distinct on (p.name, p.form)
      p.name, p.name_kana, p.family_key, p.form, p.element, p.rarity, p.series, 'csv', auth.uid()
    from parsed p
    where p.monster_no is null
      and not exists (
        select 1 from public.characters c
        where c.name = p.name and c.form is not distinct from p.form
      )
    order by p.name, p.form, p.ordinality desc
    returning 1
  )
  select count(*)::integer into v_plain_inserted from plain;

  return query select v_upsert_inserted + v_plain_inserted, v_upsert_updated;
end;
$$;

revoke execute on function public.import_characters(jsonb) from public, anon;
grant execute on function public.import_characters(jsonb) to authenticated;
