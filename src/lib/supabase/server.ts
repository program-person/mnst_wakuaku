import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

/** Server Component / Server Action / Route Handler 用。リクエストごとに生成する */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseEnv.url, supabaseEnv.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component からは cookie を書けない。
          // proxy.ts がセッション更新を担うので無視してよい。
        }
      },
    },
  });
}
