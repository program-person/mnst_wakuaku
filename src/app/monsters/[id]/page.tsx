import Link from "next/link";
import { notFound } from "next/navigation";
import { FruitSlotEditor } from "@/components/fruit-slot-editor";
import { getFruitRanks, getFruitTypes } from "@/lib/queries/masters";
import { getOwnedMonster, listSiblingEquippedFruits } from "@/lib/queries/owned-monsters";
import { createClient } from "@/lib/supabase/server";
import { archiveOwnedMonster } from "../actions";

const MAX_SLOTS = 4;

export default async function OwnedMonsterPage({ params }: PageProps<"/monsters/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const monster = await getOwnedMonster(supabase, id);
  if (!monster) notFound();

  const [fruitTypes, fruitRanks, siblingFruits, policyRows] = await Promise.all([
    getFruitTypes(supabase),
    getFruitRanks(supabase),
    listSiblingEquippedFruits(supabase, monster.character.family_key, monster.id),
    supabase.from("user_fruit_policies").select("fruit_type_id, duplicate_policy"),
  ]);
  if (policyRows.error) throw new Error(`被りポリシーの取得に失敗しました: ${policyRows.error.message}`);

  const duplicatePolicies: Record<number, string> = Object.fromEntries(
    fruitTypes.map((type) => [type.id, type.default_duplicate_policy]),
  );
  for (const row of policyRows.data) duplicatePolicies[row.fruit_type_id] = row.duplicate_policy;

  // 証の枠数より多く実が付いている場合（データ修正中など）は実の数に合わせて表示
  const slotCount = Math.min(MAX_SLOTS, Math.max(monster.hero_seal_slots, monster.equipped_fruits.length));
  const initialSlots = Array.from({ length: slotCount }, (_, index) => {
    const fruit = monster.equipped_fruits.find((item) => item.slot_no === index + 1);
    return fruit ? { fruitTypeId: fruit.fruit_type_id, fruitRankId: fruit.fruit_rank_id } : null;
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/monsters" className="text-sm text-zinc-500 hover:underline">← 所持キャラ</Link>
          <h1 className="text-2xl font-bold">
            {monster.character.name}
            <span className="ml-2 text-base font-normal text-zinc-500">{monster.copy_label}体目</span>
          </h1>
          <p className="text-sm text-zinc-500">
            {monster.character.form ? `${monster.character.form}　` : ""}
            {monster.character.monster_no ? `No.${monster.character.monster_no}　` : ""}
            枠 {monster.hero_seal_slots}
            {monster.luck !== null ? `　ラック ${monster.luck}` : ""}
            {monster.role_tag ? `　[${monster.role_tag}]` : ""}
          </p>
          {monster.memo ? <p className="mt-1 text-sm">{monster.memo}</p> : null}
        </div>
        <form action={archiveOwnedMonster}>
          <input type="hidden" name="id" value={monster.id} />
          <button className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            手放した（アーカイブ）
          </button>
        </form>
      </header>

      {slotCount === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
          英雄の証がありません。枠数を設定すると実を装着できます。
        </p>
      ) : (
        <FruitSlotEditor
          ownedMonsterId={monster.id}
          slotCount={slotCount}
          initialSlots={initialSlots}
          fruitTypes={fruitTypes}
          fruitRanks={fruitRanks}
          siblingFruits={siblingFruits}
          duplicatePolicies={duplicatePolicies}
        />
      )}
    </main>
  );
}
