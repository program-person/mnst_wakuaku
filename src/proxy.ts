import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的ファイル・画像最適化・favicon・画像・manifest は除外（未ログインでもインストールできるように）
    // 文字列リテラル内なので "\\." と書いて正規表現の「ドット文字」にする（"\." だと任意の1文字になる）
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
