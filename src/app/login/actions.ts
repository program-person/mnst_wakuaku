"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 個人利用に限定するため新規登録は提供しない。
// Supabase 側でも「新規登録を許可しない」設定にして、API 直叩きでの登録も止めている。

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
  // 失敗理由の詳細は出さない（アカウントの有無を推測されないように）
  if (error) toLoginError("メールアドレスかパスワードが違います");

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
