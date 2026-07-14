import { NextResponse } from "next/server";
import { deleteCharacter, getCharacter } from "@/lib/storage";

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
