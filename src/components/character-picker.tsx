"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type CharacterSummary = Pick<Tables<"characters">, "id" | "name" | "form" | "monster_no" | "family_key">;

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_LIMIT = 20;

/**
 * キャラマスタをインクリメンタル検索して選ぶ。見つからなければ新規作成欄を開く。
 * 選択結果は hidden input（character_id）として親フォームに渡す。
 */
export function CharacterPicker() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CharacterSummary[]>([]);
  const [selected, setSelected] = useState<CharacterSummary | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "" || selected) return;

    // 打鍵が速いと古い検索の応答が後から届くことがあるので、後始末済みの応答は捨てる
    let isStale = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      // ひらがな/カタカナ・全角半角・通称の揺れは DB 側の search_characters が吸収する
      const { data, error } = await supabase
        .rpc("search_characters", { query: trimmed, max_rows: SEARCH_LIMIT })
        .select("id, name, form, monster_no, family_key");
      if (isStale) return;
      if (error) {
        setSearchError(error.message);
        setResults([]);
        return;
      }
      setSearchError(null);
      setResults(data);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  // 入力が空・選択済みのときは結果を出さない（effect 内で state を消さずに派生値で制御する）
  const visibleResults = query.trim() === "" || selected ? [] : results;

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950">
        <input type="hidden" name="character_id" value={selected.id} />
        <span>
          <strong>{selected.name}</strong>
          {selected.form ? <span className="ml-1 text-zinc-500">（{selected.form}）</span> : null}
          {selected.monster_no ? <span className="ml-2 text-zinc-500">No.{selected.monster_no}</span> : null}
        </span>
        <button type="button" onClick={() => setSelected(null)} className="text-xs underline">
          変更
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsCreating(false);
        }}
        placeholder="キャラ名 / かな / 通称 / 図鑑No で検索（空白で絞り込み）"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        autoFocus
      />
      {searchError ? <p className="text-sm text-red-600">検索エラー: {searchError}</p> : null}

      {visibleResults.length > 0 ? (
        <ul className="max-h-64 divide-y divide-zinc-200 overflow-y-auto rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {visibleResults.map((character) => (
            <li key={character.id}>
              <button
                type="button"
                onClick={() => setSelected(character)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span>
                  {character.name}
                  {character.form ? <span className="ml-1 text-zinc-500">（{character.form}）</span> : null}
                </span>
                {character.monster_no ? <span className="text-xs text-zinc-500">No.{character.monster_no}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {query.trim() !== "" && !isCreating ? (
        <button type="button" onClick={() => setIsCreating(true)} className="text-sm underline">
          「{query.trim()}」を新規キャラとして登録する
        </button>
      ) : null}

      {isCreating ? (
        <fieldset className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <legend className="px-1 text-xs text-zinc-500">新規キャラ</legend>
          <label className="block space-y-1">
            <span>キャラ名</span>
            <input
              name="new_character_name"
              defaultValue={query.trim()}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span>形態</span>
              <input
                name="new_character_form"
                placeholder="獣神化 など"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="block space-y-1">
              <span>図鑑No（任意）</span>
              <input
                name="new_character_monster_no"
                type="number"
                min={1}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span>同キャラ判定キー（空ならキャラ名と同じ）</span>
            <input
              name="new_character_family_key"
              placeholder="形態違いを同一視するためのベース名"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </fieldset>
      ) : null}
    </div>
  );
}
