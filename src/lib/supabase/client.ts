import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseEnv } from "@/lib/env";

/** Client Component から使うブラウザ用クライアント（内部でシングルトン） */
export function createClient() {
  return createBrowserClient<Database>(supabaseEnv.url, supabaseEnv.publishableKey);
}
