import { NextResponse } from "next/server";
import { requireApiReader } from "@/lib/reader";
import { updateChildProfile } from "@/lib/storage";

// GET /api/child → het kind dat nu leest (naam + leesleeftijd).
export async function GET() {
  const reader = await requireApiReader();
  if (!reader.ok) return reader.response;
  return NextResponse.json({ child: reader.child });
}

// PATCH /api/child → leesleeftijd (en naam) van ALLEEN dit kind.
// Een id in de aanvraag wordt genegeerd.
export async function PATCH(request: Request) {
  const reader = await requireApiReader();
  if (!reader.ok) return reader.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { name, age } = body as { name?: string; age?: number };
  const nextName = typeof name === "string" && name.trim() ? name.trim() : reader.child.name;
  const nextAge = typeof age === "number" ? age : reader.child.age;
  if (nextAge < 4 || nextAge > 14) {
    return NextResponse.json({ error: "Leeftijd moet tussen 4 en 14 zijn." }, { status: 400 });
  }
  const child = await updateChildProfile(reader.child.id, reader.user.id, {
    name: nextName,
    age: nextAge,
  });
  if (!child) {
    return NextResponse.json({ error: "Profiel niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ child });
}
