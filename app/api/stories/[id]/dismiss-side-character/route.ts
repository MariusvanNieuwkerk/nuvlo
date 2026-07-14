import { NextResponse } from "next/server";
import { dismissSideCharacter } from "@/lib/storage";

// Drukt één nevenpersonage weg uit de "Sla op als personage"-suggestielijst. Verwacht een
// body met { name }. Bewust idempotent (meermaals wegdrukken kan geen kwaad) en verandert
// niets aan het verhaal zelf — het personage blijft gewoon in de illustraties.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = body && typeof body === "object" ? (body as { name?: unknown }).name : null;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Naam ontbreekt." }, { status: 400 });
  }
  await dismissSideCharacter(id, name);
  return NextResponse.json({ ok: true });
}
