import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth"];

/**
 * 期限切れの Auth トークンを更新し、Server Component とブラウザ双方に
 * 新しい cookie を渡す。未ログインなら /login へリダイレクトする。
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseEnv.url, supabaseEnv.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // createServerClient と getClaims の間に処理を挟まないこと（ランダムなログアウトの原因になる）
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isPublicPath = PUBLIC_PATH_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
