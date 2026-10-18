"use server";

import { redirect } from "next/navigation";
import { familyOwnsChild } from "@/lib/access";
import { claimLibraryAsAdmin } from "@/lib/claim-library";
import { clearActiveChildCookie, getSessionUser, setActiveChildCookie } from "@/lib/reader";
import { createChildForFamily, getChildById } from "@/lib/storage";
import { createAuthClient } from "@/lib/supabase/server";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/inloggen");
  return user;
}

export async function chooseChild(formData: FormData) {
  const user = await requireUser();
  const childId = String(formData.get("childId") ?? "");
  const child = await getChildById(childId);
  if (!child || !familyOwnsChild(user.id, child.familyId)) redirect("/wie?fout=kind");
  await setActiveChildCookie(child.id);
  redirect("/");
}

export async function createChild(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const age = Number(formData.get("age"));
  if (!name) redirect("/wie?fout=naam");
  if (!Number.isInteger(age) || age < 4 || age > 14) redirect("/wie?fout=leeftijd");

  let child;
  try {
    child = await createChildForFamily(user.id, name, age);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("maximum")) redirect("/wie?fout=vol");
    if (message.includes("Leeftijd")) redirect("/wie?fout=leeftijd");
    redirect("/wie?fout=naam");
  }

  await setActiveChildCookie(child.id);
  redirect("/");
}

export async function claimLibrary() {
  const user = await requireUser();
  const result = await claimLibraryAsAdmin(user);
  if (!result.ok) redirect("/wie?fout=beheerder");
  redirect(`/wie?gekoppeld=${result.counts.stories}`);
}

export async function signOutParent() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  await clearActiveChildCookie();
  redirect("/inloggen");
}
