import { login, signup } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; notice?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, notice } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold">わくわくの実 管理</h1>

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}

        <label className="block space-y-1 text-sm">
          <span>メールアドレス</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>パスワード</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="flex gap-2">
          <button
            formAction={login}
            className="flex-1 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            ログイン
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            新規登録
          </button>
        </div>
      </form>
    </main>
  );
}
