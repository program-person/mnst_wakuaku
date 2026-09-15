/**
 * 環境変数を起動時に検証する。未設定のまま実行時エラーになるのを防ぐため、
 * `process.env.X!` ではなくここを経由して参照する。
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません（.env.local を確認してください）`);
  }
  return value;
}

export const supabaseEnv = {
  url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  publishableKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
};
