import { createClient } from "@/lib/supabase/server";

const ICON_BUCKET = "character-icons";
// アイコンはほぼ変わらないので1週間キャッシュ。private なので CDN や共有キャッシュには載らない
const CACHE_CONTROL = "private, max-age=604800";

/**
 * 非公開バケットのアイコンを、ログイン中のユーザーにだけ返す。
 * URL を固定にしてブラウザキャッシュを効かせるため、署名付き URL ではなくこの経路を通す。
 * パスは proxy.ts の認証対象（拡張子なし）なので、未ログインはここに届く前に /login へ送られる。
 */
export async function GET(_request: Request, { params }: RouteContext<"/character-icons/[monsterNo]">) {
  const { monsterNo } = await params;
  if (!/^\d{1,9}$/.test(monsterNo)) {
    return new Response("bad request", { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data, error } = await supabase.storage.from(ICON_BUCKET).download(`monster/${monsterNo}.png`);
  if (error || !data) {
    return new Response("not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "image/png",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
