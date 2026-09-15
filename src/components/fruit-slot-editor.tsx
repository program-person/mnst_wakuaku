"use client";

import { useState, useTransition } from "react";
import { clearEquippedFruit, setEquippedFruit } from "@/app/monsters/actions";
import { FRUIT_CATEGORY_LABELS, type FruitRank, type FruitType } from "@/lib/queries/masters";

type SlotState = { fruitTypeId: number; fruitRankId: number } | null;

type SiblingFruit = { copy_label: string; fruit_type_id: number };

type FruitSlotEditorProps = {
  ownedMonsterId: string;
  slotCount: number;
  initialSlots: SlotState[];
  fruitTypes: FruitType[];
  fruitRanks: FruitRank[];
  /** 同キャラの他個体が持っている実（被り警告用） */
  siblingFruits: SiblingFruit[];
  /** 実の種類ごとの被りポリシー（ユーザー上書き反映済み） */
  duplicatePolicies: Record<number, string>;
};

const DEFAULT_RANK_CODE = "spl";

/**
 * 4スロットの実をグリッドから2タップで選ぶ。
 * スロットを選択 → 実の種類をタップ → 等級をタップ で保存される。
 */
export function FruitSlotEditor({
  ownedMonsterId,
  slotCount,
  initialSlots,
  fruitTypes,
  fruitRanks,
  siblingFruits,
  duplicatePolicies,
}: FruitSlotEditorProps) {
  const [slots, setSlots] = useState<SlotState[]>(initialSlots);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [pendingTypeId, setPendingTypeId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const typeById = new Map(fruitTypes.map((type) => [type.id, type]));
  const rankById = new Map(fruitRanks.map((rank) => [rank.id, rank]));
  const defaultRank = fruitRanks.find((rank) => rank.code === DEFAULT_RANK_CODE) ?? fruitRanks[fruitRanks.length - 1];

  const categories = [...new Set(fruitTypes.map((type) => type.category))];

  function siblingsHolding(fruitTypeId: number): string[] {
    return siblingFruits.filter((item) => item.fruit_type_id === fruitTypeId).map((item) => item.copy_label);
  }

  function isHeldByThisMonster(fruitTypeId: number, exceptSlotIndex: number): boolean {
    return slots.some((slot, index) => index !== exceptSlotIndex && slot?.fruitTypeId === fruitTypeId);
  }

  function save(slotIndex: number, fruitTypeId: number, fruitRankId: number) {
    startTransition(async () => {
      const result = await setEquippedFruit({ ownedMonsterId, slotNo: slotIndex + 1, fruitTypeId, fruitRankId });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSlots((current) => current.map((slot, index) => (index === slotIndex ? { fruitTypeId, fruitRankId } : slot)));
      setMessage(null);
      setPendingTypeId(null);
      setActiveSlot(null);
    });
  }

  function clear(slotIndex: number) {
    startTransition(async () => {
      const result = await clearEquippedFruit({ ownedMonsterId, slotNo: slotIndex + 1 });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSlots((current) => current.map((slot, index) => (index === slotIndex ? null : slot)));
      setMessage(null);
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {message}
        </p>
      ) : null}

      <ol className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: slotCount }, (_, slotIndex) => {
          const slot = slots[slotIndex];
          const type = slot ? typeById.get(slot.fruitTypeId) : undefined;
          const rank = slot ? rankById.get(slot.fruitRankId) : undefined;
          const isActive = activeSlot === slotIndex;
          const holders = slot ? siblingsHolding(slot.fruitTypeId) : [];
          const warn = holders.length > 0 && slot && duplicatePolicies[slot.fruitTypeId] === "avoid";
          return (
            <li
              key={slotIndex}
              className={`flex items-stretch rounded-lg border ${
                isActive
                  ? "border-zinc-900 ring-2 ring-zinc-900/20 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {/* ボタンの入れ子は不正なHTMLでキーボード操作もできないため、選択と取り外しを兄弟要素に分ける */}
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveSlot(isActive ? null : slotIndex);
                  setPendingTypeId(null);
                }}
                className="flex-1 rounded-l-lg p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="text-xs text-zinc-500">スロット {slotIndex + 1}</span>
                <span className="block font-medium">
                  {type ? `${type.name} ${rank?.label ?? ""}` : <span className="text-zinc-400">空き</span>}
                </span>
                {warn ? (
                  <span className="block text-xs text-red-600">⚠ {holders.join("・")}体目も所持（被りNG）</span>
                ) : null}
              </button>
              {slot ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => clear(slotIndex)}
                  aria-label={`スロット ${slotIndex + 1} の実を外す`}
                  className="rounded-r-lg px-3 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  外す
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      {activeSlot !== null ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          {pendingTypeId === null ? (
            <>
              <p className="text-sm text-zinc-500">スロット {activeSlot + 1} につける実を選択</p>
              {categories.map((category) => (
                <div key={category} className="space-y-1">
                  <h3 className="text-xs font-semibold text-zinc-500">{FRUIT_CATEGORY_LABELS[category] ?? category}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {fruitTypes
                      .filter((type) => type.category === category)
                      .map((type) => {
                        const holders = siblingsHolding(type.id);
                        const policy = duplicatePolicies[type.id] ?? type.default_duplicate_policy;
                        const heldHere = isHeldByThisMonster(type.id, activeSlot);
                        const tone =
                          heldHere
                            ? "border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-600"
                            : holders.length > 0 && policy === "avoid"
                              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                              : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
                        return (
                          <button
                            key={type.id}
                            type="button"
                            disabled={heldHere || isPending}
                            title={
                              heldHere
                                ? "この個体は既に同じ実を持っています（同一個体で重複不可）"
                                : holders.length > 0
                                  ? `${holders.join("・")}体目が所持`
                                  : type.name
                            }
                            onClick={() => setPendingTypeId(type.id)}
                            className={`rounded-md border px-2.5 py-1.5 text-sm ${tone}`}
                          >
                            {type.short_name}
                            {holders.length > 0 ? <span className="ml-1 text-xs opacity-70">×{holders.length}</span> : null}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-sm">
                <button type="button" onClick={() => setPendingTypeId(null)} className="mr-2 text-zinc-500 underline">
                  ← 実を選び直す
                </button>
                <strong>{typeById.get(pendingTypeId)?.name}</strong> の等級を選択
              </p>
              <div className="flex flex-wrap gap-1.5">
                {fruitRanks.map((rank) => (
                  <button
                    key={rank.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => save(activeSlot, pendingTypeId, rank.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      rank.id === defaultRank?.id ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {rank.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {isPending ? <p className="text-xs text-zinc-500">保存中…</p> : null}
        </div>
      ) : null}
    </div>
  );
}
