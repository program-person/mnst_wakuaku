import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listOwnedMonsters, type OwnedMonsterWithDetails } from "@/lib/queries/owned-monsters";
import { getSameCharacterMode, type SameCharacterMode } from "@/lib/queries/settings";
import { duplicateOwnedMonster } from "./actions";

type MonsterGroup = { key: string; label: string; copies: OwnedMonsterWithDetails[] };

/** 同キャラ判定モードに合わせて個体をまとめる */
function groupBySameCharacter(monsters: OwnedMonsterWithDetails[], mode: SameCharacterMode): MonsterGroup[] {
  const groups = new Map<string, MonsterGroup>();
  for (const monster of monsters) {
    const { character } = monster;
    const key = mode === "family" ? character.family_key : String(character.id);
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

export default async function MonstersPage() {
  const supabase = await createClient();
  const [monsters, mode] = await Promise.all([listOwnedMonsters(supabase), getSameCharacterMode(supabase)]);
  const groups = groupBySameCharacter(monsters, mode);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
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

      {monsters.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          まだ登録がありません。「個体を追加」から始めてください。
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
                    <span className="w-24 shrink-0 text-sm">
                      <span className="font-medium">{monster.copy_label}体目</span>
                      {monster.character.form ? <span className="block text-xs text-zinc-500">{monster.character.form}</span> : null}
                    </span>
                    {monster.role_tag ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{monster.role_tag}</span>
                    ) : null}
                    <span className="flex flex-1 flex-wrap gap-1">
                      {Array.from({ length: Math.max(monster.hero_seal_slots, monster.equipped_fruits.length) }, (_, index) => {
                        const slotNo = index + 1;
                        const fruit = monster.equipped_fruits.find((item) => item.slot_no === slotNo);
                        return fruit ? (
                          <span key={slotNo} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs dark:border-amber-800 dark:bg-amber-950">
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
