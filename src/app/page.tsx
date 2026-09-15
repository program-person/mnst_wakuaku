import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">わくわくの実 管理</h1>
        <form action={signOut} className="flex items-center">
          <span className="mr-3 max-w-48 truncate text-sm text-zinc-500">{String(data.claims.email ?? "")}</span>
          <button className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            ログアウト
          </button>
        </form>
      </header>

      <nav className="grid gap-3 sm:grid-cols-2">
        <Link href="/monsters" className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          <h2 className="font-semibold">所持キャラ</h2>
          <p className="text-sm text-zinc-500">個体の登録と実の装着</p>
        </Link>
        <Link href="/duplicates" className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          <h2 className="font-semibold">被りチェック</h2>
          <p className="text-sm text-zinc-500">同キャラで同じ実を持っている組み合わせ</p>
        </Link>
        <Link href="/characters" className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          <h2 className="font-semibold">キャラマスタ</h2>
          <p className="text-sm text-zinc-500">CSV で一括登録・書き出し</p>
        </Link>
        <Link href="/settings" className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          <h2 className="font-semibold">設定</h2>
          <p className="text-sm text-zinc-500">同キャラの判定と、実ごとの被り方針</p>
        </Link>
      </nav>
    </main>
  );
}
