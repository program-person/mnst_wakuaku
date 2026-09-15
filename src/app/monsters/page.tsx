import Link from "next/link";
import { FRUIT_CATEGORY_LABELS, getFruitTypes } from "@/lib/queries/masters";
import {
  FRUIT_CONDITIONS,
  FRUIT_CONDITION_LABELS,
  filterMonsters,
  hasActiveFilters,
  parseMonsterFilters,
} from "@/lib/monster-filters";
import { listFruitDuplicates, listOwnedMonsters, type OwnedMonsterWithDetails } from "@/lib/queries/owned-monsters";
import { getSameCharacterMode, type SameCharacterMode } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";
import { duplicateOwnedMonster } from "./actions";

// 検索に一致したキャラIDを集めるときの上限。キャラマスタ全件（数千）を十分覆う値
const CHARACTER_SEARCH_LIMIT = 5000;

const selectClass = "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950";

type MonsterGroup = { key: string; label: string; copies: OwnedMonsterWithDetails[] };

function groupKeyFor(mode: SameCharacterMode) {
  return (monster: { character_id: number; character: { family_key: string } }): string =>
    mode === "family" ? monster.character.family_key : String(monster.character_id);
}

/** 同キャラ判定モードに合わせて個体をまとめる */
function groupBySameCharacter(monsters: OwnedMonsterWithDetails[], mode: SameCharacterMode): MonsterGroup[] {
  const keyOf = groupKeyFor(mode);
  const groups = new Map<string, MonsterGroup>();
  for (const monster of monsters) {
    const { character } = monster;
    const key = keyOf(monster);
    const label = mode === "family" ? character.family_key : `${character.name}${character.form ? `（${character.form}）` : ""}`;
    const group = groups.get(key);
    if (group) group.copies.push(monster);
    else groups.set(key, { key, label, copies: [monster] });
  }
  for (const group of groups.values()) {
    group.copies.sort((a, b) => a.copy_label.localeCompare(b.copy_label, "ja", { numeric: true }));
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

function distinctSorted<Value extends string | number>(values: (Value | null)[]): Value[] {
  return [...new Set(values.filter((value): value is Value => value !== null && value !== ""))].sort((a, b) =>
    typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ja"),
  );
}

export default async function MonstersPage({ searchParams }: PageProps<"/monsters">) {
  const filters = parseMonsterFilters(await searchParams);
  const supabase = await createClient();

  const [monsters, mode, fruitTypes, duplicates, matchingCharacters] = await Promise.all([
    listOwnedMonsters(supabase),
    getSameCharacterMode(supabase),
    getFruitTypes(supabase),
    listFruitDuplicates(supabase),
    filters.query === ""
      ? Promise.resolve(null)
      : supabase
          .rpc("search_characters", { query: filters.query, max_rows: CHARACTER_SEARCH_LIMIT })
          .select("id")
          .then(({ data, error }) => {
            if (error) throw new Error(`キャラ検索に失敗しました: ${error.message}`);
            return data;
          }),
  ]);

  const duplicateMonsterIds = new Set(
    duplicates.filter((row) => row.duplicate_policy === "avoid").flatMap((row) => row.owned_monster_ids ?? []),
  );
  const filtered = filterMonsters(monsters, filters, {
    matchingCharacterIds: matchingCharacters ? new Set(matchingCharacters.map((row) => row.id)) : null,
    duplicateMonsterIds,
    groupKeyOf: groupKeyFor(mode),
  });
  const groups = groupBySameCharacter(filtered, mode);
  const isFiltering = hasActiveFilters(filters);

  // 選択肢は「実際に持っている個体」から作る（空の選択肢を出さない）
  const elements = distinctSorted(monsters.map((monster) => monster.character.element));
  const rarities = distinctSorted(monsters.map((monster) => monster.character.rarity));
  const roles = distinctSorted(monsters.map((monster) => monster.role_tag));
  const fruitCategories = [...new Set(fruitTypes.map((type) => type.category))];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="whitespace-nowrap">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">← ホーム</Link>
          <h1 className="text-2xl font-bold">所持キャラ</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <a href="/monsters/export" download className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            CSV エクスポート
          </a>
          <Link href="/monsters/import" className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            CSV インポート
          </Link>
          <Link
            href="/monsters/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ＋ 個体を追加
          </Link>
        </div>
      </header>

      {monsters.length > 0 ? (
        <form className="space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="キャラ名 / かな / 通称 / 図鑑No"
              aria-label="キャラ検索"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
              絞り込む
            </button>
          </div>

          <details open={isFiltering && filters.query === "" ? true : undefined} className="group">
            <summary className="cursor-pointer text-sm text-zinc-500">詳細な条件</summary>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs">
                <span className="text-zinc-500">属性</span>
                <select name="element" defaultValue={filters.element} className={selectClass}>
                  <option value="">すべて</option>
                  {elements.map((element) => (
                    <option key={element} value={element}>{element}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-zinc-500">レア度</span>
                <select name="rarity" defaultValue={filters.rarity ?? ""} className={selectClass}>
                  <option value="">すべて</option>
                  {rarities.map((rarity) => (
                    <option key={rarity} value={rarity}>★{rarity}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-zinc-500">役割</span>
                <select name="role" defaultValue={filters.role} className={selectClass}>
                  <option value="">すべて</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              <div className="space-y-1 text-xs">
                <span className="text-zinc-500">状態</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="empty_slot" value="1" defaultChecked={filters.emptySlotOnly} />
                  空きスロットあり
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="duplicate" value="1" defaultChecked={filters.duplicateOnly} />
                  被りNGで被っている
                </label>
              </div>
              <label className="col-span-2 space-y-1 text-xs">
                <span className="text-zinc-500">わくわくの実</span>
                <select name="fruit" defaultValue={filters.fruitTypeId ?? ""} className={selectClass}>
                  <option value="">指定しない</option>
                  {fruitCategories.map((category) => (
                    <optgroup key={category} label={FRUIT_CATEGORY_LABELS[category] ?? category}>
                      {fruitTypes
                        .filter((type) => type.category === category)
                        .map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="col-span-2 space-y-1 text-xs">
                <span className="text-zinc-500">その実を</span>
                <select name="fruit_condition" defaultValue={filters.fruitCondition} className={selectClass}>
                  {FRUIT_CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>{FRUIT_CONDITION_LABELS[condition]}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              「同キャラの誰も持っていない」＋「空きスロットあり」で、被らずにその実を付けられる個体だけが残ります。
            </p>
          </details>

          {isFiltering ? (
            <p className="flex items-center justify-between text-sm">
              <span>
                {filtered.length} / {monsters.length} 体
              </span>
              <Link href="/monsters" className="text-zinc-500 underline">条件をクリア</Link>
            </p>
          ) : null}
        </form>
      ) : null}

      {monsters.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          まだ登録がありません。「個体を追加」から始めてください。
        </p>
      ) : null}

      {monsters.length > 0 && filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          条件に合う個体がありません。
        </p>
      ) : null}

      <div className="space-y-4">
        {groups.map(({ key, label, copies }) => (
          <section key={key} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <h2 className="font-semibold">
                {label}
                <span className="ml-2 text-sm font-normal text-zinc-500">{copies.length}体</span>
              </h2>
              <form action={duplicateOwnedMonster}>
                <input type="hidden" name="source_id" value={copies[copies.length - 1].id} />
                <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  ＋ もう1体
                </button>
              </form>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {copies.map((monster) => (
                <li key={monster.id}>
                  <Link href={`/monsters/${monster.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <span className="w-20 shrink-0 text-sm sm:w-24">
                      <span className="font-medium">{monster.copy_label}体目</span>
                      {monster.character.form ? <span className="block text-xs text-zinc-500">{monster.character.form}</span> : null}
                      {monster.role_tag ? (
                        <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{monster.role_tag}</span>
                      ) : null}
                    </span>
                    <span className="flex flex-1 flex-wrap gap-1">
                      {Array.from({ length: Math.max(monster.hero_seal_slots, monster.equipped_fruits.length) }, (_, index) => {
                        const slotNo = index + 1;
                        const fruit = monster.equipped_fruits.find((item) => item.slot_no === slotNo);
                        const isFocused = fruit !== undefined && fruit.fruit_type_id === filters.fruitTypeId;
                        return fruit ? (
                          <span
                            key={slotNo}
                            className={`rounded-md border px-2 py-0.5 text-xs ${
                              isFocused
                                ? "border-sky-400 bg-sky-50 font-semibold dark:border-sky-600 dark:bg-sky-950"
                                : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                            }`}
                          >
                            {fruit.fruit_type.short_name} {fruit.fruit_rank.label}
                          </span>
                        ) : (
                          <span key={slotNo} className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-400 dark:border-zinc-700">
                            空き
                          </span>
                        );
                      })}
                      {monster.hero_seal_slots === 0 && monster.equipped_fruits.length === 0 ? (
                        <span className="text-xs text-zinc-400">証なし</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
