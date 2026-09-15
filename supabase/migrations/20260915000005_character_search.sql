-- Applied via MCP apply_migration (name: character_search)
-- 検索の表記ゆれ吸収（ひらがな/カタカナ・全角半角・記号・小書き文字）と、キャラの別名（通称）。

-- ===== 正規化関数 =====
-- 1. NFKC で全角英数・半角カナを統一し、小文字化
-- 2. 空白・記号・長音を除去（「ルシファー」「るしふぁ」「ルシ・ファー」を同一視するため）
-- 3. カタカナ → ひらがな
-- 4. 小書き文字 → 通常の文字（「ふぁ」「ふあ」の打ち分けを吸収）
create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(
    translate(
      regexp_replace(lower(normalize(coalesce(input, ''), NFKC)), '[[:space:]・ー〜~_|/\()（）「」『』【】\[\]〈〉《》.,、。!?☆★♪:：;；"''`^＾*+=<>#&@$%-]+', '', 'g'),
      'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
      'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ'
    ),
    'ぁぃぅぇぉっゃゅょゎゕゖ',
    'あいうえおつやゆよわかけ'
  )
$$;

comment on function public.normalize_search_text(text) is '検索用の正規化。アプリ側の検索語も必ずこの関数を通して比較する';

-- ===== キャラマスタに検索用の生成列 =====
alter table public.characters
  add column name_normalized text generated always as (public.normalize_search_text(name)) stored,
  add column search_text text generated always as (
    public.normalize_search_text(name) || '|' ||
    public.normalize_search_text(name_kana) || '|' ||
    public.normalize_search_text(family_key) || '|' ||
    public.normalize_search_text(form)
  ) stored;

-- ===== 別名（通称） =====
create table public.character_aliases (
  id bigserial primary key,
  character_id bigint not null references public.characters(id) on delete cascade,
  alias text not null check (btrim(alias) <> ''),
  alias_normalized text generated always as (public.normalize_search_text(alias)) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (character_id, alias_normalized)
);
comment on table public.character_aliases is 'キャラの通称・略称（例: ルシ）。検索でのみ使う';
create index character_aliases_character_idx on public.character_aliases (character_id);

alter table public.character_aliases enable row level security;
create policy "character_aliases readable by authenticated" on public.character_aliases
  for select to authenticated using (true);
create policy "character_aliases insertable by authenticated" on public.character_aliases
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "character_aliases deletable by creator" on public.character_aliases
  for delete to authenticated using ((select auth.uid()) = created_by);

-- ===== 検索語をトークンに分ける =====
-- 空白（全角含む）で区切り、各トークンを正規化。空になったトークンは捨てる
create or replace function public.search_tokens(query text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(token), array[]::text[])
  from (
    select public.normalize_search_text(part) as token
    from regexp_split_to_table(normalize(coalesce(query, ''), NFKC), '[[:space:]]+') as part
  ) tokens
  where token <> ''
$$;

-- ===== キャラ検索 =====
-- すべてのトークンが「名前/かな/同キャラキー/形態」または「別名」のどこかに含まれるキャラを返す。
-- 検索語が数字だけなら図鑑Noの完全一致も対象。並びは 名前完全一致 → 名前前方一致 → 別名完全一致 → 図鑑No。
create or replace function public.search_characters(query text, max_rows integer default 50)
returns setof public.characters
language sql
stable
set search_path = ''
as $$
  with params as (
    select public.search_tokens(query) as tokens,
           -- 9桁までに制限（それ以上は integer に収まらずエラーになる）
           case when btrim(normalize(coalesce(query, ''), NFKC)) ~ '^[0-9]{1,9}$'
                then btrim(normalize(query, NFKC))::integer end as monster_no
  )
  select c.*
  from public.characters c, params p
  where cardinality(p.tokens) = 0
     or c.monster_no = p.monster_no
     or not exists (
       select 1 from unnest(p.tokens) as t(token)
       where position(t.token in c.search_text) = 0
         and not exists (
           select 1 from public.character_aliases a
           where a.character_id = c.id and position(t.token in a.alias_normalized) > 0
         )
     )
  order by
    -- is not distinct from だと「図鑑No未指定 × 図鑑Noが空のキャラ」が先頭に来るので coalesce で false に倒す
    coalesce(c.monster_no = p.monster_no, false) desc,
    (c.name_normalized = array_to_string(p.tokens, '')) desc,
    (position(coalesce(p.tokens[1], '') in c.name_normalized) = 1) desc,
    exists (select 1 from public.character_aliases a where a.character_id = c.id and a.alias_normalized = array_to_string(p.tokens, '')) desc,
    c.monster_no asc nulls last,
    c.id asc
  limit greatest(1, least(coalesce(max_rows, 50), 5000))
$$;
