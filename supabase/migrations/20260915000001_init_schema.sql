-- Applied to Supabase project rhvbgcgjfnhvgubnnfzs via MCP apply_migration (name: init_schema)

-- ===== Master: fruit types =====
create table public.fruit_types (
  id smallserial primary key,
  code text not null unique,
  name text not null,
  short_name text not null,
  category text not null check (category in ('attack','support','quest_reward','survival','other')),
  effect_scope text not null check (effect_scope in ('self','party')),
  stacks_in_party boolean not null default false,
  default_duplicate_policy text not null default 'avoid'
    check (default_duplicate_policy in ('avoid','allow','prefer')),
  sort_order integer not null,
  is_active boolean not null default true,
  attributes jsonb not null default '{}'::jsonb
);
comment on table public.fruit_types is 'わくわくの実の種類マスタ';
comment on column public.fruit_types.effect_scope is 'self=装備キャラのみ / party=パーティ内で最高等級1つのみ有効';
comment on column public.fruit_types.stacks_in_party is 'パーティ内で複数装備時に効果が重複するか（一撃失心のみ true）';
comment on column public.fruit_types.default_duplicate_policy is '同キャラ複数体で同じ実を持つことの既定方針 avoid=避ける allow=可 prefer=推奨';

-- ===== Master: fruit ranks =====
create table public.fruit_ranks (
  id smallserial primary key,
  code text not null unique,
  label text not null,
  rank_value integer not null unique
);
comment on table public.fruit_ranks is 'わくわくの実の等級マスタ（rank_value が大きいほど上位）';

-- ===== Master: characters =====
create table public.characters (
  id bigserial primary key,
  monster_no integer,
  name text not null,
  name_kana text,
  family_key text not null,
  form text,
  element text,
  rarity smallint,
  series text,
  attributes jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.characters is 'キャラマスタ（全ユーザー共有）';
comment on column public.characters.family_key is '同キャラ判定キー。形態違い（進化/神化/獣神化…）を同一視するためのベース名';
create unique index characters_monster_no_key on public.characters (monster_no) where monster_no is not null;
create index characters_family_key_idx on public.characters (family_key);
create index characters_name_idx on public.characters (name);

-- ===== User settings =====
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  same_character_mode text not null default 'family'
    check (same_character_mode in ('family','character')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.user_settings.same_character_mode is 'family=形態違いも同キャラ扱い / character=図鑑No単位';

-- ===== User overrides of duplicate policy =====
create table public.user_fruit_policies (
  user_id uuid not null references auth.users(id) on delete cascade,
  fruit_type_id smallint not null references public.fruit_types(id) on delete cascade,
  duplicate_policy text not null check (duplicate_policy in ('avoid','allow','prefer')),
  primary key (user_id, fruit_type_id)
);

-- ===== Owned monsters (個体) =====
create table public.owned_monsters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id bigint not null references public.characters(id) on delete restrict,
  copy_label text not null default '1',
  hero_seal_slots smallint not null default 0 check (hero_seal_slots between 0 and 4),
  luck smallint check (luck is null or luck between 0 and 99),
  role_tag text,
  memo text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.owned_monsters is '所持個体。同キャラ複数体は copy_label で区別';
create index owned_monsters_user_idx on public.owned_monsters (user_id);
create index owned_monsters_character_idx on public.owned_monsters (character_id);

-- ===== Equipped fruits =====
create table public.equipped_fruits (
  id uuid primary key default gen_random_uuid(),
  owned_monster_id uuid not null references public.owned_monsters(id) on delete cascade,
  slot_no smallint not null check (slot_no between 1 and 4),
  fruit_type_id smallint not null references public.fruit_types(id),
  fruit_rank_id smallint not null references public.fruit_ranks(id),
  attached_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owned_monster_id, slot_no)
);
create index equipped_fruits_type_idx on public.equipped_fruits (fruit_type_id);

-- ===== Event log =====
create table public.fruit_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  owned_monster_id uuid references public.owned_monsters(id) on delete set null,
  event_type text not null check (event_type in ('attach','detach','replace','upgrade','transfer','note')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index fruit_events_user_idx on public.fruit_events (user_id, created_at desc);

-- ===== updated_at trigger =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger characters_set_updated_at before update on public.characters
  for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger owned_monsters_set_updated_at before update on public.owned_monsters
  for each row execute function public.set_updated_at();
create trigger equipped_fruits_set_updated_at before update on public.equipped_fruits
  for each row execute function public.set_updated_at();

-- ===== RLS =====
alter table public.fruit_types enable row level security;
alter table public.fruit_ranks enable row level security;
alter table public.characters enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_fruit_policies enable row level security;
alter table public.owned_monsters enable row level security;
alter table public.equipped_fruits enable row level security;
alter table public.fruit_events enable row level security;

create policy "fruit_types readable by authenticated" on public.fruit_types
  for select to authenticated using (true);
create policy "fruit_ranks readable by authenticated" on public.fruit_ranks
  for select to authenticated using (true);

create policy "characters readable by authenticated" on public.characters
  for select to authenticated using (true);
create policy "characters insertable by authenticated" on public.characters
  for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "characters updatable by creator" on public.characters
  for update to authenticated using ((select auth.uid()) = created_by);

create policy "user_settings own rows" on public.user_settings
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_fruit_policies own rows" on public.user_fruit_policies
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owned_monsters own rows" on public.owned_monsters
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fruit_events own rows" on public.fruit_events
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "equipped_fruits via owned monster" on public.equipped_fruits
  for all to authenticated
  using (exists (
    select 1 from public.owned_monsters om
    where om.id = equipped_fruits.owned_monster_id and om.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.owned_monsters om
    where om.id = equipped_fruits.owned_monster_id and om.user_id = (select auth.uid())
  ));

-- ===== Duplicate detection view =====
create view public.v_fruit_duplicates
with (security_invoker = true) as
select
  om.user_id,
  case when coalesce(us.same_character_mode, 'family') = 'family'
       then c.family_key else c.id::text end as group_key,
  min(c.name) as character_name,
  ef.fruit_type_id,
  ft.name as fruit_name,
  coalesce(ufp.duplicate_policy, ft.default_duplicate_policy) as duplicate_policy,
  count(*)::integer as copies,
  array_agg(om.id order by om.copy_label) as owned_monster_ids,
  array_agg(om.copy_label order by om.copy_label) as copy_labels
from public.equipped_fruits ef
join public.owned_monsters om on om.id = ef.owned_monster_id
join public.characters c on c.id = om.character_id
join public.fruit_types ft on ft.id = ef.fruit_type_id
left join public.user_settings us on us.user_id = om.user_id
left join public.user_fruit_policies ufp on ufp.user_id = om.user_id and ufp.fruit_type_id = ef.fruit_type_id
where not om.is_archived
group by om.user_id, 2, ef.fruit_type_id, ft.name, 6
having count(*) > 1;
comment on view public.v_fruit_duplicates is '同キャラ（family_key または図鑑単位）で同じ実を複数体が持っている組み合わせ';

-- ===== Seed: ranks =====
insert into public.fruit_ranks (code, label, rank_value) values
  ('r2',   '2級',    10),
  ('r2m',  '2級M',   20),
  ('r2l',  '2級L',   30),
  ('r1',   '1級',    40),
  ('r1m',  '1級M',   50),
  ('r1l',  '1級L',   60),
  ('sp',   '特級',   70),
  ('spm',  '特級M',  80),
  ('spl',  '特級L',  90),
  ('spel', '特級EL', 100);
