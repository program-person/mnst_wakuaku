/**
 * 環境変数を起動時に検証する。未設定のまま実行時エラーになるのを防ぐため、
 * `process.env.X!` ではなくここを経由して参照する。
 *
 * 注意: NEXT_PUBLIC_* はビルド時に `process.env.NEXT_PUBLIC_X` という
 * 静的な参照だけが置換される。`process.env[name]` のような動的参照は
 * ブラウザ側で undefined になるので、必ず名前を書き下す。
 */
function assertEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません（.env.local を確認してください）`);
  }
  return value;
}

export const supabaseEnv = {
  url: assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  publishableKey: assertEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
