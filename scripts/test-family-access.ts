// Controleert de gezinsregels, en daarna in de echte database of
// account A de boeken van account B en de nog losse oude boeken niet ziet.
//
//   npx tsx scripts/test-family-access.ts

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  canClaimUnassignedChild,
  canReadOwnedRecord,
  childCookieOptions,
  childOwnsRecord,
  familyOwnsChild,
  isLibraryAdmin,
} from "@/lib/access";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function pureTests() {
  const gezinA = "gezin-a";
  const gezinB = "gezin-b";
  const kindA = "kind-a";
  const kindB = "kind-b";

  assert(familyOwnsChild(gezinA, gezinA), "eigen gezin mag het kind zien");
  assert(!familyOwnsChild(gezinA, gezinB), "ander gezin mag het kind niet zien");
  assert(!familyOwnsChild(gezinA, null), "los kind hoort bij niemand");
  assert(!familyOwnsChild("", gezinA), "lege ouder telt niet");

  assert(childOwnsRecord(kindA, kindA), "eigen kind mag het eigen boek");
  assert(!childOwnsRecord(kindA, kindB), "broer of zus ziet het boek van de ander niet");
  assert(!childOwnsRecord(kindA, null), "boek zonder kind telt niet");

  assert(
    !canReadOwnedRecord({
      userId: gezinA,
      childFamilyId: gezinB,
      activeChildId: kindB,
      recordChildId: kindB,
    }),
    "verzonnen kind-id van een ander gezin wordt geweigerd",
  );
  assert(
    !canReadOwnedRecord({
      userId: gezinA,
      childFamilyId: null,
      activeChildId: "kind-1",
      recordChildId: "kind-1",
    }),
    "oude bibliotheek is niet van het eerste account",
  );
  assert(
    canReadOwnedRecord({
      userId: gezinA,
      childFamilyId: gezinA,
      activeChildId: kindA,
      recordChildId: kindA,
    }),
    "eigen kind van dit gezin mag het eigen boek",
  );

  assert(!isLibraryAdmin("ouder@example.com", ""), "lege beheermail = niemand");
  assert(!isLibraryAdmin("ouder@example.com", undefined), "ontbrekende beheermail = niemand");
  assert(!isLibraryAdmin(null, "ouder@example.com"), "zonder login geen beheerder");
  assert(isLibraryAdmin("Ouder@Example.com", " ouder@example.com "), "hoofdletters maken niet uit");
  assert(!isLibraryAdmin("ander@example.com", "ouder@example.com"), "ander adres is geen beheerder");

  assert(canClaimUnassignedChild(true, null), "beheerder mag een los kind koppelen");
  assert(!canClaimUnassignedChild(false, null), "gewoon account mag niet koppelen");
  assert(!canClaimUnassignedChild(true, gezinA), "een kind met een gezin blijft daar");

  const cookie = childCookieOptions(true);
  assert(cookie.httpOnly === true, "kind-cookie is HttpOnly");
  assert(cookie.sameSite === "lax", "kind-cookie is SameSite lax");
  assert(cookie.secure === true, "kind-cookie is secure in productie");
}

async function sourceGuards() {
  const signup = await fs.readFile(path.join(process.cwd(), "app/inloggen/actions.ts"), "utf8");
  assert(!signup.includes("claimUnassigned"), "aanmelden koppelt geen oude boeken");
  assert(!signup.includes("claimLibrary"), "aanmelden roept de koppeling niet aan");

  const claim = await fs.readFile(path.join(process.cwd(), "lib/claim-library.ts"), "utf8");
  assert(claim.includes("isLibraryAdmin"), "koppelen controleert de beheerder");

  const storage = await fs.readFile(path.join(process.cwd(), "lib/storage.ts"), "utf8");
  assert(storage.includes('.is("family_id", null)'), "alleen kinderen zonder gezin worden gekoppeld");
}

async function loadEnvLocal() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env al gezet
  }
}

function client(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(url: string, anonKey: string, email: string, password: string) {
  const supabase = client(url, anonKey);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return supabase;
}

async function idsOf(supabase: SupabaseClient, table: "children" | "stories" | "characters") {
  const { data, error } = await supabase.from(table).select("id");
  if (error) throw error;
  return (data ?? []).map((row) => String(row.id));
}

async function liveTests() {
  await loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    console.log("Database-test overgeslagen: supabase-sleutels ontbreken.");
    return;
  }

  const admin = client(url, serviceKey);
  const stamp = Date.now();
  const password = `Test-${randomUUID()}`;
  const emailA = `nuvlo-toegang-a-${stamp}@example.com`;
  const emailB = `nuvlo-toegang-b-${stamp}@example.com`;
  let userA = "";
  let userB = "";
  let childA = "";
  let childB = "";
  let looseChild = "";
  let storyA = "";
  let storyB = "";
  let looseStory = "";

  try {
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdA.error || !createdA.data.user || createdB.error || !createdB.data.user) {
      throw createdA.error ?? createdB.error ?? new Error("Testaccounts maken mislukt.");
    }
    userA = createdA.data.user.id;
    userB = createdB.data.user.id;
    childA = `toegang-a-${stamp}`;
    childB = `toegang-b-${stamp}`;
    looseChild = `toegang-los-${stamp}`;

    const { error: childError } = await admin.from("children").insert([
      { id: childA, name: "Test A", age: 8, family_id: userA },
      { id: childB, name: "Test B", age: 8, family_id: userB },
      { id: looseChild, name: "Los", age: 8, family_id: null },
    ]);
    if (childError) throw childError;

    const { data: stories, error: storyError } = await admin
      .from("stories")
      .insert([
        { child_id: childA, title: "Boek A" },
        { child_id: childB, title: "Boek B" },
        { child_id: looseChild, title: "Los boek" },
      ])
      .select("id, child_id");
    if (storyError || !stories) throw storyError ?? new Error("Testboeken maken mislukt.");
    storyA = String(stories.find((row) => row.child_id === childA)?.id);
    storyB = String(stories.find((row) => row.child_id === childB)?.id);
    looseStory = String(stories.find((row) => row.child_id === looseChild)?.id);

    const { error: characterError } = await admin.from("characters").insert([
      { child_id: childA, name: "Held A", kind: "hero" },
      { child_id: childB, name: "Held B", kind: "hero" },
    ]);
    if (characterError) throw characterError;

    const { data: oldChild } = await admin
      .from("children")
      .select("family_id")
      .eq("id", "kind-1")
      .maybeSingle();
    assert(oldChild?.family_id == null, "het echte oude kind is nog niet gekoppeld");

    const guest = client(url, anonKey);
    const guestStories = await idsOf(guest, "stories");
    assert(guestStories.length === 0, "zonder login zijn er geen boeken zichtbaar");

    const asA = await signIn(url, anonKey, emailA, password);
    const childrenA = await idsOf(asA, "children");
    const storiesA = await idsOf(asA, "stories");
    const charactersA = await idsOf(asA, "characters");
    assert(childrenA.includes(childA), "account A ziet het eigen kind");
    assert(!childrenA.includes(childB), "account A ziet het kind van B niet");
    assert(!childrenA.includes(looseChild), "account A ziet een los kind niet");
    assert(!childrenA.includes("kind-1"), "account A ziet de oude bibliotheek niet");
    assert(storiesA.includes(storyA), "account A ziet het eigen boek");
    assert(!storiesA.includes(storyB), "account A ziet het boek van B niet");
    assert(!storiesA.includes(looseStory), "account A ziet een los boek niet");
    assert(storiesA.length === 1, "account A ziet alleen het eigen testboek");
    assert(charactersA.length === 1, "account A ziet alleen het eigen personage");

    const { data: directB } = await asA.from("stories").select("id").eq("id", storyB);
    assert((directB ?? []).length === 0, "directe url naar boek B geeft niets terug");
    const { data: directLoose } = await asA.from("stories").select("id").eq("id", looseStory);
    assert((directLoose ?? []).length === 0, "directe url naar een los boek geeft niets terug");

    const { data: stolen } = await asA
      .from("children")
      .update({ name: "Gepikt" })
      .eq("id", "kind-1")
      .select("id");
    assert((stolen ?? []).length === 0, "account A kan het oude kind niet overnemen");

    const { error: insertOther } = await asA.from("children").insert({
      id: `toegang-fout-${stamp}`,
      name: "Fout",
      age: 8,
      family_id: userB,
    });
    assert(Boolean(insertOther), "account A kan geen kind in gezin B zetten");

    const { data: stillOld } = await admin
      .from("children")
      .select("family_id, name")
      .eq("id", "kind-1")
      .maybeSingle();
    assert(stillOld?.family_id == null, "het echte oude kind is na de test nog los");
    assert(stillOld?.name !== "Gepikt", "de naam van het echte kind is niet veranderd");

    console.log("Database-test gelukt: gezinnen zien elkaars boeken niet, oude boeken blijven los.");
  } finally {
    if (storyA || storyB || looseStory) {
      await admin.from("stories").delete().in("child_id", [childA, childB, looseChild].filter(Boolean));
    }
    await admin.from("characters").delete().in("child_id", [childA, childB].filter(Boolean));
    await admin.from("children").delete().in("id", [childA, childB, looseChild].filter(Boolean));
    await admin.from("children").delete().eq("id", `toegang-fout-${stamp}`);
    if (userA) await admin.auth.admin.deleteUser(userA);
    if (userB) await admin.auth.admin.deleteUser(userB);
  }
}

async function main() {
  pureTests();
  await sourceGuards();
  console.log("Regels gelukt.");
  await liveTests();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
