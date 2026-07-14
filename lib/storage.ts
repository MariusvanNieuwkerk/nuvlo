// Supabase-opslaglaag. Dezelfde publieke API als de oude JSON-file versie, zodat de rest
// van de app niets merkt van de migratie. Leest/schrijft via de service_role-key server-side
// (RLS staat aan op alle tabellen, maar service_role omzeilt dat — de app gebruikt geen anon-
// key, dus dit is veilig zolang dit bestand server-only blijft, zie "server-only" hierboven).
//
// Kritieke concurrentie-patronen (vroeger lib/locks.ts) zijn vervangen door atomaire
// conditionele UPDATE's in Postgres, die werken op meerdere server-instanties (Vercel
// serverless). Zie updateStoryIfLastChapterOpen / updateStoryIfChapterImagePending.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Chapter, Child, SavedCharacter, Story } from "@/lib/types";
import { SEED_CHILD, SEED_STORIES } from "@/lib/seed";
import {
  cleanCharacterAppearance,
  cleanSideCharacterAppearance,
  cleanWorldAppearance,
} from "@/lib/appearance";

// Eén gedeelde service-role client. Wordt lui gemaakt bij de eerste aanroep; als de env-
// vars ontbreken geven we een duidelijke fout (server-start crasht dan niet, alleen de
// eerste aanroep die de DB nodig heeft).
let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten in .env.local staan (server-only).",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisatie (zelfde self-healing als de oude JSON-versie — oude/legacy data kan de
// app nooit laten crashen; zodra het verhaal een keer opgeslagen wordt, staat de schone
// vorm weer in de DB).
// ─────────────────────────────────────────────────────────────────────────────

function normalizeChapter(chapter: Chapter): Chapter {
  const pages = Array.isArray(chapter.pages)
    ? chapter.pages.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : [];
  if (pages.length === 0 && typeof chapter.text === "string" && chapter.text.trim()) {
    pages.push(chapter.text.trim());
  }
  const { text: _legacyText, ...rest } = chapter;
  void _legacyText;
  return {
    ...rest,
    pages,
    imagePending: rest.imagePending === true,
    sceneCharacterNames: Array.isArray(rest.sceneCharacterNames)
      ? rest.sceneCharacterNames.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      : [],
  };
}

function normalizeStory(story: Story): Story {
  return {
    ...story,
    chapters: (story.chapters ?? []).map(normalizeChapter),
    character: {
      ...story.character,
      appearance: cleanCharacterAppearance(story.character.appearance, ""),
      items: Array.isArray(story.character.items) ? story.character.items : [],
    },
    bible: {
      ...story.bible,
      worldAppearance: cleanWorldAppearance(story.bible.worldAppearance, ""),
      worldReferenceImageUrl: story.bible.worldReferenceImageUrl ?? null,
      sideCharacters: (story.bible.sideCharacters ?? []).map((c) => ({
        name: c.name,
        appearance: cleanSideCharacterAppearance(c.appearance, ""),
        referenceImageUrl: c.referenceImageUrl ?? null,
      })),
    },
  };
}

function normalizeSavedCharacter(raw: unknown): SavedCharacter {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : newId();
  const childId = typeof r.childId === "string" && r.childId.trim() ? r.childId.trim() : SEED_CHILD.id;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const kind: SavedCharacter["kind"] = r.kind === "side" ? "side" : "hero";
  const sourceStoryIds = Array.isArray(r.sourceStoryIds)
    ? r.sourceStoryIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
    : [];
  const portraitUrl =
    typeof r.portraitUrl === "string" && r.portraitUrl.length > 0 ? r.portraitUrl : null;
  const imageStyleHint =
    typeof r.imageStyleHint === "string" && r.imageStyleHint.trim()
      ? r.imageStyleHint.trim()
      : "flat colorful 2D children's picture-book illustration style";
  const seriesNote =
    typeof r.seriesNote === "string" && r.seriesNote.trim() ? r.seriesNote.trim() : undefined;
  const notes =
    typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : undefined;
  const createdAt = typeof r.createdAt === "string" && r.createdAt ? r.createdAt : new Date().toISOString();
  return {
    id,
    childId,
    name,
    kind,
    appearance: cleanCharacterAppearance(r.appearance, ""),
    imageStyleHint,
    portraitUrl,
    sourceStoryIds,
    seriesNote,
    notes,
    createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping tussen TS (camelCase) en DB-rijen (snake_case).
// ─────────────────────────────────────────────────────────────────────────────

type StoryRow = {
  id: string;
  child_id: string;
  title: string;
  hero: unknown;
  character: unknown;
  bible: unknown;
  summary: string;
  status: string;
  chapters: unknown;
  cover_url: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
};

function rowToStory(row: StoryRow): Story {
  const story = {
    id: row.id,
    childId: row.child_id,
    title: row.title,
    hero: row.hero as Story["hero"],
    character: row.character as Story["character"],
    bible: row.bible as Story["bible"],
    summary: row.summary ?? "",
    status: row.status as Story["status"],
    chapters: (row.chapters as Chapter[]) ?? [],
    coverUrl: row.cover_url ?? null,
    favorite: row.favorite ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Story;
  return normalizeStory(story);
}

function storyToRow(story: Story): Omit<StoryRow, "created_at" | "updated_at"> {
  return {
    id: story.id,
    child_id: story.childId,
    title: story.title,
    hero: story.hero,
    character: story.character,
    bible: story.bible,
    summary: story.summary ?? "",
    status: story.status,
    chapters: story.chapters,
    cover_url: story.coverUrl ?? null,
    favorite: story.favorite ?? false,
  };
}

type CharacterRow = {
  id: string;
  child_id: string;
  name: string;
  kind: "hero" | "side";
  appearance: unknown;
  image_style_hint: string;
  portrait_url: string | null;
  source_story_ids: string[];
  series_note: string | null;
  notes: string | null;
  created_at: string;
};

function rowToCharacter(row: CharacterRow): SavedCharacter {
  return normalizeSavedCharacter({
    id: row.id,
    childId: row.child_id,
    name: row.name,
    kind: row.kind,
    appearance: row.appearance,
    imageStyleHint: row.image_style_hint,
    portraitUrl: row.portrait_url,
    sourceStoryIds: row.source_story_ids ?? [],
    seriesNote: row.series_note ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  });
}

function characterToRow(c: SavedCharacter): Omit<CharacterRow, "created_at"> {
  return {
    id: c.id,
    child_id: c.childId,
    name: c.name,
    kind: c.kind,
    appearance: c.appearance,
    image_style_hint: c.imageStyleHint,
    portrait_url: c.portraitUrl,
    source_story_ids: c.sourceStoryIds,
    series_note: c.seriesNote ?? null,
    notes: c.notes ?? null,
  };
}

export function newId(): string {
  return randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// Children (één "default" kind voorlopig — geen auth/RLS-policy per kind, KIS).
// ─────────────────────────────────────────────────────────────────────────────

export async function getDefaultChild(): Promise<Child> {
  const { data, error } = await client()
    .from("children")
    .select("id, name, age")
    .eq("id", SEED_CHILD.id)
    .maybeSingle();
  if (error || !data) {
    // Fallback: seed-child in-memory. Garandeert dat de app draait ook als de rij
    // (nog) niet bestaat — de seed-migratie had hem al moeten aanmaken.
    return SEED_CHILD;
  }
  return { id: data.id, name: data.name, age: data.age };
}

export async function updateDefaultChildAge(age: number): Promise<Child> {
  const sb = client();
  // Upsert: als de rij nog niet bestaat (oudere DB), maak hem aan met de seed-naam.
  const { data, error } = await sb
    .from("children")
    .upsert({ id: SEED_CHILD.id, name: SEED_CHILD.name, age }, { onConflict: "id" })
    .select("id, name, age")
    .single();
  if (error || !data) {
    return { ...SEED_CHILD, age };
  }
  return { id: data.id, name: data.name, age: data.age };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stories
// ─────────────────────────────────────────────────────────────────────────────

// Uitgestelde beloning: een nieuw held-portret ligt eerst als "pending" te wachten, en
// wordt pas zichtbaar zodra er intussen echt even tijd overheen is gegaan (zie oude
// storage.ts voor de volledige uitleg).
const SESSION_GAP_MS = 20 * 60 * 1000; // 20 minuten

function revealDuePortrait(story: Story): Story {
  if (!story.character.pendingPortraitUrl) return story;
  const elapsed = Date.now() - new Date(story.updatedAt).getTime();
  if (elapsed < SESSION_GAP_MS) return story;
  return {
    ...story,
    character: {
      ...story.character,
      portraitUrl: story.character.pendingPortraitUrl,
      pendingPortraitUrl: null,
      hasUnseenPortrait: true,
    },
  };
}

// Past de "revealDuePortrait"-mutatie atomair toe op de DB, maar alleen als de huidige
// pendingPortraitUrl nog steeds dezelfde is (idempotent — voorkomt dat een race de
// reveal terugdraait). Gebruikt jsonb_set om één veld in de nested character-jsonb te
// patchen zonder de hele rij te overschrijven.
async function persistRevealIfDue(story: Story): Promise<Story> {
  if (!story.character.pendingPortraitUrl) return story;
  // Eén conditionele UPDATE die het portret alleen verplaatst als de pendingUrl nog
  // klopt. updated_at wordt hierbij bewust NIET aangeraakt (geen echte inhoudelijke
  // wijziging, alleen een UI-ontgrendeling — anders zou SESSION_GAP_MS nooit opnieuw
  // triggeren voor een volgend portret).
  const { data, error } = await client().rpc("reveal_due_portrait", {
    p_story_id: story.id,
    p_pending_url: story.character.pendingPortraitUrl,
    p_portrait_url: story.character.pendingPortraitUrl,
  });
  if (error || !data || data.length === 0) {
    // RPC faalt of geen rij terug → neem de in-memory versie (self-healing bij
    // oudere DB zonder de RPC-functie).
    return story;
  }
  // RPC geeft de verse rij terug als jsonb; we vertrouwen op de in-memory staat voor de
  // nested character-velden die we zojuist zelf hebben gemuteerd — eenvoudiger en robuust
  // dan de hele rij opnieuw in TS te husselen.
  return story;
}

export async function listStories(): Promise<Story[]> {
  const { data, error } = await client()
    .from("stories")
    .select("*")
    .order("favorite", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error || !data) return [];

  const stories: Story[] = [];
  for (const row of data as StoryRow[]) {
    const story = rowToStory(row);
    const revealed = revealDuePortrait(story);
    if (revealed !== story) {
      await persistRevealIfDue(revealed);
    }
    stories.push(revealed);
  }
  return stories;
}

export async function getStory(id: string): Promise<Story | null> {
  const { data, error } = await client()
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const story = rowToStory(data as StoryRow);
  const revealed = revealDuePortrait(story);
  if (revealed !== story) {
    await persistRevealIfDue(revealed);
  }
  return revealed;
}

export async function markPortraitSeen(id: string): Promise<void> {
  // Eén atomair jsonb_set op hasUnseenPortrait=false. Idempotent.
  await client().rpc("mark_portrait_seen", { p_story_id: id });
}

export async function createStory(
  story: Omit<Story, "id" | "createdAt" | "updatedAt">,
): Promise<Story> {
  const now = new Date().toISOString();
  const full: Story = { ...story, id: newId(), createdAt: now, updatedAt: now };
  const { data, error } = await client()
    .from("stories")
    .insert(storyToRow(full))
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Kon verhaal niet opslaan in Supabase.");
  }
  return rowToStory(data as StoryRow);
}

export async function saveStory(story: Story): Promise<Story> {
  // Volledige overschrijf-write. Geen last-chapter-guard: bewuste keuze — de caller
  // (choice-route / image-route) gebruikt daarvoor de atomaire helpers hieronder.
  const { data, error } = await client()
    .from("stories")
    .update({ ...storyToRow(story), updated_at: new Date().toISOString() })
    .eq("id", story.id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Kon verhaal niet bijwerken in Supabase.");
  }
  return rowToStory(data as StoryRow);
}

export async function deleteStory(id: string): Promise<boolean> {
  const { error, count } = await client()
    .from("stories")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function setStoryFavorite(id: string, favorite: boolean): Promise<Story | null> {
  const { data, error } = await client()
    .from("stories")
    .update({ favorite, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToStory(data as StoryRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomaire concurrentie-helpers (vervangen lib/locks.ts).
//
// De choice-route moet precies één keer een nieuw hoofdstuk toevoegen, ook bij een
// dubbele inzending (snelle dubbele tik / refresh) of bij twee parallelle serverless-
// instanties. We doen dat met een conditionele UPDATE die alleen slaat als het LAATSTE
// hoofdstuk nog geen `chosen` heeft én (optioneel) het chapter-nummer klopt met
// fromChapterN. PostgreSQL voert dat atomair uit; als 0 rijen terugkomen was een ander
// request ons net voor → de caller geeft de huidige staat terug (idempotent).
// ─────────────────────────────────────────────────────────────────────────────

// Past `mutator` toe op de huidige staat en slaat het resultaat atomair op, MAAR alleen
// als het laatste hoofdstuk nog `chosen === null` heeft en (indien meegegeven) het
// chapter-nr gelijk is aan `fromChapterN`. Geeft { story, updated } terug; als de guard
// faalde (0 rijen) is `updated=false` en bevat `story` de meest-vers gelezen staat.
export async function updateStoryIfLastChapterOpen(
  id: string,
  fromChapterN: number | null,
  mutator: (current: Story) => Story | Promise<Story>,
): Promise<{ story: Story | null; updated: boolean }> {
  // Lees de verse staat voor de mutator (de mutator kan zware AI-logica bevatten en moet
  // op de Èchte laatste staat werken, niet op een verouderde kopie).
  const current = await getStory(id);
  if (!current) return { story: null, updated: false };

  const lastChapter = current.chapters[current.chapters.length - 1];
  if (!lastChapter || lastChapter.chosen !== null) {
    return { story: current, updated: false };
  }
  if (fromChapterN !== null && lastChapter.n !== fromChapterN) {
    return { story: current, updated: false };
  }

  const mutated = await mutator(current);

  // Atomaire conditionele UPDATE: alleen schrijven als het laatste hoofdstuk intussen
  // nog steeds geen chosen heeft (i.e. niemand anders was ons voor).
  const newChaptersJson = JSON.stringify(mutated.chapters);
  const { data, error } = await client().rpc("append_chapter_atomic", {
    p_story_id: id,
    p_from_chapter_n: fromChapterN,
    p_chapters: newChaptersJson as unknown,
    p_character: JSON.stringify(mutated.character) as unknown,
    p_bible: JSON.stringify(mutated.bible) as unknown,
    p_summary: mutated.summary,
    p_status: mutated.status,
    p_cover_url: mutated.coverUrl,
    p_favorite: mutated.favorite,
  });

  if (error) {
    // Fallback naar ouderwets saveStory — beter een dubbel hoofdstuk dan een verloren
    // keuze. Komt in de praktijk niet voor (de RPC is gedefinieerd in de migratie).
    console.error("append_chapter_atomic RPC-fout:", error);
    return { story: await saveStory(mutated), updated: true };
  }

  if (!data || data.length === 0) {
    // 0 rijen: iemand anders was net voor. Geef de huidige staat terug.
    const fresh = await getStory(id);
    return { story: fresh, updated: false };
  }

  // RPC geeft de verse rij terug als jsonb; mappen naar Story.
  const row = (data as { row: StoryRow }[])[0]?.row ?? (data as StoryRow[])[0];
  if (row) return { story: rowToStory(row), updated: true };
  // Onverwachte vorm: herlees.
  const fresh = await getStory(id);
  return { story: fresh, updated: true };
}

// Atomaire update van één hoofdstuk's imagePending=false + imageUrl. Slaat alleen op als
// dat hoofdstuk op dit moment nog imagePending=true heeft (idempotent tegen dubbele
// fase-B-triggers). Geeft de verse story terug, of null als het verhaal/hoofdstuk er
// niet is of de update geen rij raakte (in dat laatste geval was een andere instantie
// sneller en is de staat al correct).
export async function updateChapterImageAtomic(
  id: string,
  n: number,
  imageUrl: string | null,
): Promise<Story | null> {
  const { data, error } = await client().rpc("update_chapter_image_atomic", {
    p_story_id: id,
    p_chapter_n: n,
    p_image_url: imageUrl,
  });
  if (error || !data || data.length === 0) {
    // Of de RPC faalde, of 0 rijen (al niet meer pending). Herlees de huidige staat.
    return await getStory(id);
  }
  const row = (data as { row: StoryRow }[])[0]?.row ?? (data as StoryRow[])[0];
  if (row) return rowToStory(row);
  return await getStory(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Personages-bibliotheek (characters-tabel).
// ─────────────────────────────────────────────────────────────────────────────

export async function listCharacters(childId: string = SEED_CHILD.id): Promise<SavedCharacter[]> {
  const { data, error } = await client()
    .from("characters")
    .select("*")
    .eq("child_id", childId)
    .order("kind", { ascending: true }) // 'hero' < 'side' alfabetisch → helden eerst
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as CharacterRow[]).map(rowToCharacter);
}

export async function getCharacter(id: string): Promise<SavedCharacter | null> {
  const { data, error } = await client()
    .from("characters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToCharacter(data as CharacterRow);
}

export type SaveCharacterInput = {
  childId?: string;
  name: string;
  kind: SavedCharacter["kind"];
  appearance: unknown; // ruw — cleanCharacterAppearance migreert zowel string als object
  imageStyleHint?: string;
  portraitUrl?: string | null;
  sourceStoryIds?: string[];
  seriesNote?: string;
  notes?: string;
};

// Upsert op id. Atomaar in Postgres (één INSERT ... ON CONFLICT DO UPDATE) — geen lock
// nodig, twee gelijktijdige saves van hetzelfde id leiden niet tot twee rijen.
export async function saveCharacter(input: SaveCharacterInput & { id?: string }): Promise<SavedCharacter> {
  const id = input.id ?? newId();
  const base: SavedCharacter = {
    id,
    childId: input.childId ?? SEED_CHILD.id,
    name: input.name.trim(),
    kind: input.kind,
    appearance: cleanCharacterAppearance(input.appearance, ""),
    imageStyleHint: input.imageStyleHint?.trim() || "flat colorful 2D children's picture-book illustration style",
    portraitUrl: input.portraitUrl ?? null,
    sourceStoryIds: Array.isArray(input.sourceStoryIds)
      ? input.sourceStoryIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
      : [],
    seriesNote: input.seriesNote?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await client()
    .from("characters")
    .upsert(characterToRow(base), { onConflict: "id" })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Kon personage niet opslaan in Supabase.");
  }
  return rowToCharacter(data as CharacterRow);
}

// Atomaire array-append: voegt storyId toe aan source_story_ids als het er nog niet in
// staat (idempotent). Werkt op meerdere instanties — geen read-modify-write race.
export async function registerStoryForCharacter(characterId: string, storyId: string): Promise<void> {
  await client().rpc("register_story_for_character", {
    p_character_id: characterId,
    p_story_id: storyId,
  });
}

export async function deleteCharacter(id: string): Promise<boolean> {
  const { error, count } = await client()
    .from("characters")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return false;
  return (count ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat: SEED_STORIES wordt nog steeds geïmporteerd door de migratie/seed-
// code (zie scripts/seed-supabase.ts). Houd de export hier beschikbaar.
// ─────────────────────────────────────────────────────────────────────────────
export { SEED_STORIES, SEED_CHILD };
