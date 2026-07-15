import { NextResponse } from "next/server";
import { getDefaultChild, updateDefaultChild } from "@/lib/storage";

// GET /api/child → huidige default-kind (naam + leesleeftijd).
export async function GET() {
  const child = await getDefaultChild();
  return NextResponse.json({ child });
}

// PATCH /api/child → leesleeftijd (en optioneel naam) bijwerken. Dit is het "niveau" dat
// bepaalt hoe moeilijk de zinnen worden — één waarde voor de app, niet per held.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const current = await getDefaultChild();
  const { name, age } = body as { name?: string; age?: number };
  const nextName = typeof name === "string" && name.trim() ? name.trim() : current.name;
  const nextAge = typeof age === "number" ? age : current.age;
  if (nextAge < 4 || nextAge > 14) {
    return NextResponse.json({ error: "Leeftijd moet tussen 4 en 14 zijn." }, { status: 400 });
  }
  const child = await updateDefaultChild(nextName, nextAge);
  return NextResponse.json({ child });
}
