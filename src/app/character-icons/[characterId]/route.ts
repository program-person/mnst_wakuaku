import { createClient } from "@/lib/supabase/server";

const ICON_BUCKET = "character-icons";
// アイコンはほぼ変わらないので1週間キャッシュ。private なので CDN や共有キャッシュには載らない
const CACHE_CONTROL = "private, max-age=604800";
const NOT_FOUND_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * 非公開バケットのアイコンを、ログイン中のユーザーにだけ返す。
 * URL を固定にしてブラウザキャッシュを効かせるため、署名付き URL ではなくこの経路を通す。
 * キャラマスタの内部IDで引き、保存先は icon_path 列に従う（図鑑No の有無やファイル名の規則に依存しない）。
 * パスは proxy.ts の認証対象（拡張子なし）なので、未ログインはここに届く前に /login へ送られる。
 */
export async function GET(_request: Request, { params }: RouteContext<"/character-icons/[characterId]">) {
  const { characterId } = await params;
  if (!/^\d{1,18}$/.test(characterId)) {
    return new Response("bad request", { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("icon_path")
    .eq("id", Number(characterId))
    .maybeSingle();
  if (characterError) {
    return new Response("failed to load character", { status: 500, headers: NOT_FOUND_HEADERS });
  }
  if (!character?.icon_path) {
    return new Response("not found", { status: 404, headers: NOT_FOUND_HEADERS });
  }

  const { data, error } = await supabase.storage.from(ICON_BUCKET).download(character.icon_path);
  if (error || !data) {
    return new Response("not found", { status: 404, headers: NOT_FOUND_HEADERS });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "image/png",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
