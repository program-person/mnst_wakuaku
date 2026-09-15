import Image from "next/image";

type CharacterIconProps = {
  monsterNo: number | null;
  iconPath: string | null;
  name: string;
  element: string | null;
  /** 表示サイズ（px） */
  size?: number;
};

const DEFAULT_SIZE = 32;

/** アイコンが無いキャラ用に、属性色の丸を出す（コラボキャラなど図鑑に無いもの） */
const ELEMENT_COLORS: Record<string, string> = {
  火: "bg-red-500 text-white",
  水: "bg-sky-500 text-white",
  木: "bg-emerald-500 text-white",
  光: "bg-amber-400 text-zinc-900",
  闇: "bg-violet-600 text-white",
};
const UNKNOWN_ELEMENT_COLOR = "bg-zinc-400 text-white dark:bg-zinc-600";

export function CharacterIcon({ monsterNo, iconPath, name, element, size = DEFAULT_SIZE }: CharacterIconProps) {
  if (iconPath && monsterNo !== null) {
    return (
      <Image
        src={`/character-icons/${monsterNo}`}
        alt=""
        width={size}
        height={size}
        // 画像変換サーバーはログイン情報を持たずに取りに行くため失敗する。変換後の画像が共有キャッシュに載るのも避けたい
        unoptimized
        loading="lazy"
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = Array.from(name)[0] ?? "?";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${ELEMENT_COLORS[element ?? ""] ?? UNKNOWN_ELEMENT_COLOR}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initial}
    </span>
  );
}
