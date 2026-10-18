import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { CHILD_COOKIE, childCookieOptions, familyOwnsChild } from "@/lib/access";
import { getChildById } from "@/lib/storage";
import { createAuthClient } from "@/lib/supabase/server";
import type { Child } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Leest het gekozen kind uit de HttpOnly-cookie en controleert het gezin in de database.
// Een verzonnen id, of een kind van een ander gezin, telt als "niemand gekozen".
export async function getActiveChildForUser(userId: string): Promise<Child | null> {
  const jar = await cookies();
  const childId = jar.get(CHILD_COOKIE)?.value;
  if (!childId) return null;
  const child = await getChildById(childId);
  if (!child || !familyOwnsChild(userId, child.familyId)) return null;
  return child;
}

export async function requirePageReader(): Promise<{ user: User; child: Child }> {
  const user = await getSessionUser();
  if (!user) redirect("/inloggen");
  const child = await getActiveChildForUser(user.id);
  if (!child) redirect("/wie");
  return { user, child };
}

export async function requireApiReader(): Promise<
  | { ok: true; user: User; child: Child }
  | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Log eerst in." }, { status: 401 }),
    };
  }
  const child = await getActiveChildForUser(user.id);
  if (!child) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Kies eerst wie er leest." }, { status: 403 }),
    };
  }
  return { ok: true, user, child };
}

export async function setActiveChildCookie(childId: string) {
  const jar = await cookies();
  jar.set(CHILD_COOKIE, childId, childCookieOptions(process.env.NODE_ENV === "production"));
}

export async function clearActiveChildCookie() {
  const jar = await cookies();
  jar.set(CHILD_COOKIE, "", {
    ...childCookieOptions(process.env.NODE_ENV === "production"),
    maxAge: 0,
  });
}
