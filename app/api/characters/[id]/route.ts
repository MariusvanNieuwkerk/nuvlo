import { NextResponse } from "next/server";
import { deleteCharacter, getCharacter, saveCharacter } from "@/lib/storage";

// DELETE /api/characters/[id] → verwijdert een opgeslagen personage uit de bibliotheek.
// Raakt geen verhalen aan: een verhaal behoudt zijn eigen character/appearance, ook als de
// bibliotheek-entry weg is. Dat is bewust: een opgeslagen personage is een sjabloon, geen
// referentie die verhalen nodig hebben om te blijven bestaan.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getCharacter(id);
  if (!existing) {
    return NextResponse.json({ error: "Personage niet gevonden." }, { status: 404 });
  }
  const ok = await deleteCharacter(id);
  if (!ok) {
    return NextResponse.json({ error: "Personage niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// PATCH /api/characters/[id] → naam en/of uiterlijk van een opgeslagen held bijwerken.
// Bewust geen nieuw portret genereren hier (kosten): het bestaande plaatje blijft tot een
// volgend boek. Body: { name?, appearance? } — appearance mag een string (freeform) of
// een object zijn.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getCharacter(id);
  if (!existing) {
    return NextResponse.json({ error: "Personage niet gevonden." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { name, appearance } = body as { name?: string; appearance?: unknown };
  const nextName = typeof name === "string" && name.trim() ? name.trim() : existing.name;
  if (nextName.length > 40) {
    return NextResponse.json({ error: "Naam is te lang." }, { status: 400 });
  }

  let nextAppearance: unknown = existing.appearance;
  if (typeof appearance === "string") {
    nextAppearance = {
      ...existing.appearance,
      freeform: appearance.trim(),
    };
  } else if (appearance && typeof appearance === "object") {
    nextAppearance = appearance;
  }

  const saved = await saveCharacter({
    id: existing.id,
    childId: existing.childId,
    name: nextName,
    kind: existing.kind,
    appearance: nextAppearance,
    imageStyleHint: existing.imageStyleHint,
    portraitUrl: existing.portraitUrl,
    sourceStoryIds: existing.sourceStoryIds,
    seriesNote: existing.seriesNote,
    notes: existing.notes,
  });

  return NextResponse.json({ character: saved });
}
