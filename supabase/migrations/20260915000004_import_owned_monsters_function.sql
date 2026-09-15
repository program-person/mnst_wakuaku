-- Applied via MCP apply_migration (names: import_owned_monsters_function, import_owned_monsters_counter_fix)
-- 所持データCSV取り込み用。1行 = 1個体。
-- キャラ解決: monster_no → (name, form) の順。見つからなければキャラを新規作成。
-- 個体解決: (user, character, copy_label) の未アーカイブ個体。無ければ作成。
-- slots: [{slot_no, fruit_type_id, fruit_rank_id}] で装着、{slot_no, clear:true} で取り外し。
-- 行単位のエラーは errors に積んでスキップし、他の行は続行する。
create or replace function public.import_owned_monsters(rows jsonb)
returns table (inserted integer, updated integer, characters_created integer, errors jsonb)
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row jsonb;
  v_line integer;
  v_monster_no integer;
  v_name text;
  v_form text;
  v_copy_label text;
  v_character_id bigint;
  v_match_count integer;
  v_owned_id uuid;
  v_slot jsonb;
  v_row_created_character boolean;
  v_row_inserted_owned boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_created integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  for v_row in select value from jsonb_array_elements(rows) loop
    v_line := (v_row->>'line')::integer;
    v_monster_no := nullif(btrim(v_row->>'monster_no'), '')::integer;
    v_name := nullif(btrim(v_row->>'name'), '');
    v_form := nullif(btrim(v_row->>'form'), '');
    v_copy_label := coalesce(nullif(btrim(v_row->>'copy_label'), ''), '1');
    v_character_id := null;
    v_owned_id := null;
    v_row_created_character := false;
    v_row_inserted_owned := false;

    begin
      if v_monster_no is not null then
        select c.id into v_character_id from public.characters c where c.monster_no = v_monster_no;
      end if;

      if v_character_id is null and v_name is not null then
        select count(*), min(c.id) into v_match_count, v_character_id
        from public.characters c
        where c.name = v_name and (v_form is null or c.form = v_form);

        if v_match_count > 1 then
          v_errors := v_errors || jsonb_build_object('line', v_line,
            'message', format('「%s」に一致するキャラが %s 件あります。図鑑Noか形態を指定してください', v_name, v_match_count));
          continue;
        end if;
      end if;

      if v_character_id is null then
        if v_name is null then
          v_errors := v_errors || jsonb_build_object('line', v_line,
            'message', format('図鑑No %s のキャラがマスタにありません。名前を入れると新規作成します', v_monster_no));
          continue;
        end if;
        insert into public.characters (monster_no, name, family_key, form, source, created_by)
        values (v_monster_no, v_name, v_name, v_form, 'csv', v_user)
        returning id into v_character_id;
        v_row_created_character := true;
      end if;

      select om.id into v_owned_id
      from public.owned_monsters om
      where om.user_id = v_user and om.character_id = v_character_id
        and om.copy_label = v_copy_label and not om.is_archived
      limit 1;

      if v_owned_id is null then
        insert into public.owned_monsters (user_id, character_id, copy_label, hero_seal_slots, luck, role_tag, memo)
        values (
          v_user, v_character_id, v_copy_label,
          coalesce(nullif(btrim(v_row->>'hero_seal_slots'), '')::smallint, 0),
          nullif(btrim(v_row->>'luck'), '')::smallint,
          nullif(btrim(v_row->>'role_tag'), ''),
          nullif(btrim(v_row->>'memo'), '')
        )
        returning id into v_owned_id;
        v_row_inserted_owned := true;
      else
        -- 空欄は既存値を残す
        update public.owned_monsters om set
          hero_seal_slots = coalesce(nullif(btrim(v_row->>'hero_seal_slots'), '')::smallint, om.hero_seal_slots),
          luck = coalesce(nullif(btrim(v_row->>'luck'), '')::smallint, om.luck),
          role_tag = coalesce(nullif(btrim(v_row->>'role_tag'), ''), om.role_tag),
          memo = coalesce(nullif(btrim(v_row->>'memo'), ''), om.memo)
        where om.id = v_owned_id;
      end if;

      for v_slot in select value from jsonb_array_elements(coalesce(v_row->'slots', '[]'::jsonb)) loop
        if coalesce((v_slot->>'clear')::boolean, false) then
          delete from public.equipped_fruits ef
          where ef.owned_monster_id = v_owned_id and ef.slot_no = (v_slot->>'slot_no')::smallint;
        else
          insert into public.equipped_fruits (owned_monster_id, slot_no, fruit_type_id, fruit_rank_id)
          values (v_owned_id, (v_slot->>'slot_no')::smallint,
                  (v_slot->>'fruit_type_id')::smallint, (v_slot->>'fruit_rank_id')::smallint)
          on conflict (owned_monster_id, slot_no) do update set
            fruit_type_id = excluded.fruit_type_id,
            fruit_rank_id = excluded.fruit_rank_id;
        end if;
      end loop;

      -- 実が枠数より多く付いたら枠数を広げる（証の枠数の入力漏れ対策）
      update public.owned_monsters om set
        hero_seal_slots = greatest(om.hero_seal_slots,
          coalesce((select max(ef.slot_no) from public.equipped_fruits ef where ef.owned_monster_id = om.id), 0))
      where om.id = v_owned_id;

      -- 行の処理がすべて成功してから数える（例外時はブロックごと巻き戻るため）
      if v_row_created_character then v_created := v_created + 1; end if;
      if v_row_inserted_owned then v_inserted := v_inserted + 1; else v_updated := v_updated + 1; end if;

    exception when others then
      -- 型変換エラーや制約違反はこの行だけ巻き戻して続行
      v_errors := v_errors || jsonb_build_object('line', v_line, 'message', sqlerrm);
    end;
  end loop;

  return query select v_inserted, v_updated, v_created, v_errors;
end;
$$;

revoke execute on function public.import_owned_monsters(jsonb) from public, anon;
grant execute on function public.import_owned_monsters(jsonb) to authenticated;
