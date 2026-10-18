"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";

function readLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

function redirectForAuthError(error: { message: string; code?: string }, mode: "in" | "up"): never {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();
  if (code === "email_address_invalid" || message.includes("email address")) {
    redirect("/inloggen?fout=email");
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    redirect("/inloggen?fout=bestaat");
  }
  if (mode === "in" && (code === "invalid_credentials" || message.includes("invalid login"))) {
    redirect("/inloggen?fout=geen-account");
  }
  redirect("/inloggen?fout=controleer");
}

export async function signIn(formData: FormData) {
  const { email, password } = readLogin(formData);
  if (!email || password.length < 8) redirect("/inloggen?fout=leeg");

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirectForAuthError(error, "in");
  redirect("/wie");
}

function adminAuth() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) redirect("/inloggen?fout=controleer");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Nieuw ouderaccount. Meteen bevestigd, zodat er geen mailstap tussen zit.
// Oude boeken worden hier bewust niet gekoppeld.
export async function signUp(formData: FormData) {
  const { email, password } = readLogin(formData);
  if (!email || password.length < 8) redirect("/inloggen?fout=leeg");

  const admin = adminAuth();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    const message = createError.message.toLowerCase();
    const already =
      createError.code === "email_exists" ||
      message.includes("already") ||
      message.includes("registered");
    if (!already) redirectForAuthError(createError, "up");
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (createError) redirect("/inloggen?fout=bestaat");
    redirectForAuthError(error, "in");
  }
  redirect("/wie");
}
