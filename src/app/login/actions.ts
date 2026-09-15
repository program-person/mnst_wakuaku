"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData): { email: string; password: string } | null {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return null;
  if (email.trim() === "" || password === "") return null;
  return { email: email.trim(), password };
}

function toLoginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const credentials = readCredentials(formData);
  if (!credentials) toLoginError("メールアドレスとパスワードを入力してください");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) toLoginError(`ログインに失敗しました: ${error.message}`);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const credentials = readCredentials(formData);
  if (!credentials) toLoginError("メールアドレスとパスワードを入力してください");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) toLoginError(`登録に失敗しました: ${error.message}`);

  // メール確認が有効な場合はセッションが無いので案内だけ出す
  if (!data.session) {
    redirect("/login?notice=" + encodeURIComponent("確認メールを送信しました。メール内のリンクを開いてからログインしてください"));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`ログアウトに失敗しました: ${error.message}`);
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
