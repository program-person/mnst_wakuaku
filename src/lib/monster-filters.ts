/**
 * 所持キャラ一覧の絞り込み。URL の検索パラメータ ⇔ 条件オブジェクト の変換と、判定そのものを持つ。
 * DB に依存しない純粋関数にして、画面とは別に検証できるようにしている。
 */

export const FRUIT_CONDITIONS = ["has", "lacks", "lacks_in_group"] as const;
export type FruitCondition = (typeof FRUIT_CONDITIONS)[number];

export const FRUIT_CONDITION_LABELS: Record<FruitCondition, string> = {
  has: "持っている",
  lacks: "持っていない",
  lacks_in_group: "同キャラの誰も持っていない",
};

export type MonsterFilters = {
  query: string;
  element: string;
  rarity: number | null;
  role: string;
  fruitTypeId: number | null;
  fruitCondition: FruitCondition;
  emptySlotOnly: boolean;
  duplicateOnly: boolean;
};

export const EMPTY_FILTERS: MonsterFilters = {
  query: "",
  element: "",
  rarity: null,
  role: "",
  fruitTypeId: null,
  fruitCondition: "lacks_in_group",
  emptySlotOnly: false,
  duplicateOnly: false,
};

const MAX_RARITY = 9;

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parsePositiveInteger(value: string, max: number): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : null;
}

/** 不正な値は黙って無視する（URL を手で書き換えられても落ちないように） */
export function parseMonsterFilters(params: RawSearchParams): MonsterFilters {
  const condition = first(params.fruit_condition);
  return {
    query: first(params.q),
    element: first(params.element),
    rarity: parsePositiveInteger(first(params.rarity), MAX_RARITY),
    role: first(params.role),
    fruitTypeId: parsePositiveInteger(first(params.fruit), Number.MAX_SAFE_INTEGER),
    fruitCondition: (FRUIT_CONDITIONS as readonly string[]).includes(condition)
      ? (condition as FruitCondition)
      : EMPTY_FILTERS.fruitCondition,
    emptySlotOnly: first(params.empty_slot) === "1",
    duplicateOnly: first(params.duplicate) === "1",
  };
}

export function hasActiveFilters(filters: MonsterFilters): boolean {
  return (
    filters.query !== "" ||
    filters.element !== "" ||
    filters.rarity !== null ||
    filters.role !== "" ||
    filters.fruitTypeId !== null ||
    filters.emptySlotOnly ||
    filters.duplicateOnly
  );
}

/** 絞り込みに必要な個体の最小限の形 */
export type FilterableMonster = {
  id: string;
  character_id: number;
  hero_seal_slots: number;
  role_tag: string | null;
  character: { element: string | null; rarity: number | null };
  equipped_fruits: { fruit_type_id: number }[];
};

export type FilterContext<Monster extends FilterableMonster = FilterableMonster> = {
  /** キャラ検索に一致したキャラID。検索語が空なら null（= 全キャラ対象） */
  matchingCharacterIds: ReadonlySet<number> | null;
  /** 被りNGの実で被っている個体ID */
  duplicateMonsterIds: ReadonlySet<string>;
  /** 同キャラ判定のグループキー（設定のモードに従う） */
  groupKeyOf: (monster: Monster) => string;
};

export function filterMonsters<Monster extends FilterableMonster>(
  monsters: Monster[],
  filters: MonsterFilters,
  context: FilterContext<Monster>,
): Monster[] {
  // 「同キャラの誰も持っていない」判定用に、実を持っているグループを先に集める（絞り込み前の全個体から）
  const groupsHoldingFruit = new Set<string>();
  if (filters.fruitTypeId !== null && filters.fruitCondition === "lacks_in_group") {
    for (const monster of monsters) {
      if (monster.equipped_fruits.some((fruit) => fruit.fruit_type_id === filters.fruitTypeId)) {
        groupsHoldingFruit.add(context.groupKeyOf(monster));
      }
    }
  }

  return monsters.filter((monster) => {
    if (context.matchingCharacterIds && !context.matchingCharacterIds.has(monster.character_id)) return false;
    if (filters.element !== "" && monster.character.element !== filters.element) return false;
    if (filters.rarity !== null && monster.character.rarity !== filters.rarity) return false;
    if (filters.role !== "" && monster.role_tag !== filters.role) return false;
    if (filters.emptySlotOnly && monster.equipped_fruits.length >= monster.hero_seal_slots) return false;
    if (filters.duplicateOnly && !context.duplicateMonsterIds.has(monster.id)) return false;

    if (filters.fruitTypeId !== null) {
      const holds = monster.equipped_fruits.some((fruit) => fruit.fruit_type_id === filters.fruitTypeId);
      if (filters.fruitCondition === "has" && !holds) return false;
      if (filters.fruitCondition === "lacks" && holds) return false;
      if (filters.fruitCondition === "lacks_in_group" && groupsHoldingFruit.has(context.groupKeyOf(monster))) return false;
    }
    return true;
  });
}
