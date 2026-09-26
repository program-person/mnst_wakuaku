"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  lookupCharactersByNumbers,
  saveScreenshotIcons,
  type CharacterMatch,
  type SaveResult,
  type ScreenshotIconEntry,
} from "@/app/icons/import/actions";
import { averageBrightness, readMonsterNumber } from "@/lib/icon-import/digit-reader";
import { gridCells, type Box } from "@/lib/icon-import/layout";
import { COMMON_FORMS } from "@/lib/monst-forms";

/** 位置合わせに使った端末の縦横比（1440×2992）。大きくずれるとマス目の位置が合わない */
const REFERENCE_ASPECT = 2992 / 1440;
const ASPECT_TOLERANCE = 0.03;
const ICON_QUALITY = 0.9;
/** 1回の送信にまとめる件数（サーバーの受信上限に収めるため） */
const SAVE_CHUNK_SIZE = 30;

type CellDraft = {
  key: string;
  fileName: string;
  previewUrl: string;
  blob: Blob;
  brightness: number;
  numberText: string;
  include: boolean;
  name: string;
  form: string;
  overwriteDictionaryIcon: boolean;
  match: CharacterMatch | null;
  result: SaveResult | null;
};

function parseNumber(text: string): number | null {
  const normalized = text.normalize("NFKC").replace(/[^0-9]/g, "");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function cropImageData(context: CanvasRenderingContext2D, box: Box): ImageData {
  return context.getImageData(box.x, box.y, box.width, box.height);
}

function toWebp(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("画像を扱えませんでした"));
  context.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像の変換に失敗しました"))), "image/webp", ICON_QUALITY);
  });
}

/** スクショ1枚を、マスごとのアイコン画像と読み取った図鑑No に分ける（すべてブラウザ内で処理） */
async function splitScreenshot(file: File, fileIndex: number): Promise<{ cells: CellDraft[]; warning: string | null }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("画像を扱えませんでした");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const aspect = canvas.height / canvas.width;
  const warning =
    Math.abs(aspect - REFERENCE_ASPECT) / REFERENCE_ASPECT > ASPECT_TOLERANCE
      ? `${file.name}: 画面の縦横比が位置合わせした端末と違うため、アイコンの位置がずれている可能性があります`
      : null;

  const cells: CellDraft[] = [];
  for (const cell of gridCells(canvas.width, canvas.height)) {
    const number = readMonsterNumber(cropImageData(context, cell.label));
    const iconData = cropImageData(context, cell.icon);
    const blob = await toWebp(iconData);
    cells.push({
      key: `${fileIndex}-${cell.row}-${cell.column}`,
      fileName: file.name,
      previewUrl: URL.createObjectURL(blob),
      blob,
      brightness: Math.round(averageBrightness(iconData) * 1000) / 1000,
      numberText: number === null ? "" : String(number),
      // 読めなかったマスも外さない。未所持で暗いラベルは読めない可能性がある（要検証）ため、番号を手で入れれば保存できるようにする。
      // 下段の表示に隠れたマスは番号が入らない限り保存されないので、残しておいても害はない
      include: true,
      name: "",
      form: "",
      overwriteDictionaryIcon: false,
      match: null,
      result: null,
    });
  }
  return { cells, warning };
}

const STATUS_STYLES: Record<SaveResult["status"], string> = {
  saved: "text-emerald-700 dark:text-emerald-300",
  numbered: "text-sky-700 dark:text-sky-300",
  skipped: "text-zinc-500",
  error: "text-red-700 dark:text-red-300",
};

export function ScreenshotIconImporter() {
  const [cells, setCells] = useState<CellDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const previewUrls = useRef<string[]>([]);

  // 作ったプレビュー用 URL は画面を離れるときに解放する
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function updateCell(key: string, patch: Partial<CellDraft>) {
    setCells((current) => current.map((cell) => (cell.key === key ? { ...cell, ...patch } : cell)));
  }

  async function refreshMatches(targets: CellDraft[]) {
    const numbers = targets.map((cell) => parseNumber(cell.numberText)).filter((value): value is number => value !== null);
    const matches = await lookupCharactersByNumbers(numbers);
    const byNumber = new Map(matches.map((match) => [match.monsterNo, match]));
    const keys = new Set(targets.map((cell) => cell.key));
    setCells((current) =>
      current.map((cell) => {
        if (!keys.has(cell.key)) return cell;
        const number = parseNumber(cell.numberText);
        return { ...cell, match: number === null ? null : (byNumber.get(number) ?? null) };
      }),
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const offset = cells.length;
      const nextWarnings: string[] = [];
      const added: CellDraft[] = [];
      for (const [index, file] of [...fileList].entries()) {
        const { cells: split, warning } = await splitScreenshot(file, offset + index);
        if (warning) nextWarnings.push(warning);
        added.push(...split);
      }
      previewUrls.current.push(...added.map((cell) => cell.previewUrl));
      setCells((current) => [...current, ...added]);
      setWarnings((current) => [...current, ...nextWarnings]);
      await refreshMatches(added);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "スクショの読み込みに失敗しました");
    } finally {
      setIsProcessing(false);
    }
  }

  /** 図鑑No が1つずつ続くマスは同じキャラの形態違いであることが多いので、名前をまとめて写す */
  function copyNameToFollowingRun(key: string) {
    setCells((current) => {
      const start = current.findIndex((cell) => cell.key === key);
      if (start < 0) return current;
      const name = current[start].name;
      let previous = parseNumber(current[start].numberText);
      const next = [...current];
      for (let index = start + 1; index < next.length; index++) {
        const number = parseNumber(next[index].numberText);
        if (previous === null || number !== previous + 1 || next[index].match) break;
        next[index] = { ...next[index], name };
        previous = number;
      }
      return next;
    });
  }

  function handleSave() {
    const targets = cells.filter(
      (cell) => cell.include && parseNumber(cell.numberText) !== null && (cell.match !== null || cell.name.trim() !== ""),
    );
    if (targets.length === 0) {
      setMessage("保存できるアイコンがありません。図鑑Noと、未登録のキャラには名前を入れてください");
      return;
    }
    setMessage(null);
    startSaving(async () => {
      const allResults: SaveResult[] = [];
      for (let offset = 0; offset < targets.length; offset += SAVE_CHUNK_SIZE) {
        const chunk = targets.slice(offset, offset + SAVE_CHUNK_SIZE);
        const formData = new FormData();
        const entries: ScreenshotIconEntry[] = chunk.map((cell) => ({
          key: cell.key,
          monsterNo: parseNumber(cell.numberText) as number,
          characterId: cell.match?.id,
          name: cell.match ? undefined : cell.name.trim(),
          form: cell.match ? undefined : cell.form,
          brightness: cell.brightness,
          overwriteDictionaryIcon: cell.overwriteDictionaryIcon,
        }));
        formData.set("entries", JSON.stringify(entries));
        for (const cell of chunk) formData.set(`icon-${cell.key}`, new File([cell.blob], `${cell.key}.webp`, { type: "image/webp" }));
        try {
          allResults.push(...(await saveScreenshotIcons(formData)));
        } catch (error) {
          const text = error instanceof Error ? error.message : "保存に失敗しました";
          allResults.push(...chunk.map((cell) => ({ key: cell.key, status: "error" as const, message: text })));
        }
      }
      const byKey = new Map(allResults.map((result) => [result.key, result]));
      setCells((current) => current.map((cell) => (byKey.has(cell.key) ? { ...cell, result: byKey.get(cell.key) ?? null } : cell)));
      const savedCount = allResults.filter((result) => result.status === "saved").length;
      const errorCount = allResults.filter((result) => result.status === "error").length;
      setMessage(`保存 ${savedCount} 件、図鑑Noのみ記録 ${allResults.length - savedCount - errorCount} 件、エラー ${errorCount} 件`);
      await refreshMatches(targets);
    });
  }

  function clearAll() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setCells([]);
    setWarnings([]);
    setMessage(null);
  }

  const included = cells.filter((cell) => cell.include);
  const needsNumberCount = included.filter((cell) => parseNumber(cell.numberText) === null).length;
  const matchedCount = included.filter((cell) => cell.match).length;
  const needsNameCount = included.filter(
    (cell) => parseNumber(cell.numberText) !== null && !cell.match && cell.name.trim() === "",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
          {isProcessing ? "読み取り中…" : "図鑑のスクショを選ぶ"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isProcessing}
            className="sr-only"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {cells.length > 0 ? (
          <>
            <span className="text-sm text-zinc-500">
              対象 {included.length} / 登録済みキャラ {matchedCount} / 名前待ち {needsNameCount} / 図鑑No待ち {needsNumberCount}
            </span>
            <button type="button" onClick={clearAll} className="ml-auto text-sm text-zinc-500 underline">
              やり直す
            </button>
          </>
        ) : null}
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {warning}
        </p>
      ))}
      {message ? <p className="rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-900">{message}</p> : null}

      {cells.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cells.map((cell) => {
            const number = parseNumber(cell.numberText);
            return (
              <li
                key={cell.key}
                className={`space-y-2 rounded-lg border p-2 text-sm ${
                  cell.include ? "border-zinc-300 dark:border-zinc-700" : "border-dashed border-zinc-200 opacity-50 dark:border-zinc-800"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ブラウザ内で作った一時的な画像（blob URL）なので最適化の対象外 */}
                <img src={cell.previewUrl} alt="" className="w-full rounded-md" />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cell.include}
                    onChange={(event) => updateCell(cell.key, { include: event.target.checked })}
                  />
                  取り込む
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">図鑑No</span>
                  <input
                    value={cell.numberText}
                    inputMode="numeric"
                    onChange={(event) => updateCell(cell.key, { numberText: event.target.value, match: null, result: null })}
                    onBlur={() => void refreshMatches([cell])}
                    className={`w-full rounded-md border px-2 py-1 dark:bg-zinc-950 ${
                      number === null ? "border-red-400" : "border-zinc-300 dark:border-zinc-700"
                    }`}
                  />
                </label>

                {cell.match ? (
                  <div className="space-y-1">
                    <p className="text-xs">
                      <span className="text-zinc-500">登録済み: </span>
                      {cell.match.name}
                      {cell.match.form ? `（${cell.match.form}）` : ""}
                    </p>
                    {cell.match.iconSource === "dictionary" ? (
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        <input
                          type="checkbox"
                          checked={cell.overwriteDictionaryIcon}
                          onChange={(event) => updateCell(cell.key, { overwriteDictionaryIcon: event.target.checked })}
                        />
                        図鑑のアイコンを置き換える
                      </label>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      value={cell.name}
                      placeholder="キャラ名"
                      aria-label="キャラ名"
                      onChange={(event) => updateCell(cell.key, { name: event.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                    <select
                      value={cell.form}
                      aria-label="形態"
                      onChange={(event) => updateCell(cell.key, { form: event.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value="">形態（未設定）</option>
                      {COMMON_FORMS.map((form) => (
                        <option key={form} value={form}>
                          {form}
                        </option>
                      ))}
                    </select>
                    {cell.name.trim() !== "" ? (
                      <button type="button" onClick={() => copyNameToFollowingRun(cell.key)} className="text-xs text-zinc-500 underline">
                        続く連番にも同じ名前
                      </button>
                    ) : null}
                  </div>
                )}

                {cell.result ? <p className={`text-xs ${STATUS_STYLES[cell.result.status]}`}>{cell.result.message}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {cells.length > 0 ? (
        <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
          <button
            type="button"
            disabled={isSaving || isProcessing}
            onClick={handleSave}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isSaving ? "保存中…" : "保存する"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
