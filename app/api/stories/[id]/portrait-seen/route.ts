import { NextResponse } from "next/server";
import { markPortraitSeen } from "@/lib/storage";

// Kleine "ik heb het gezien"-bevestiging: de lees-/verhaalpagina roept dit één keer aan nadat
// het "[held] is veranderd sinds gisteren"-moment getoond is, zodat het niet opnieuw verschijnt.
// Bewust idempotent en zonder body — meermaals aanroepen kan geen kwaad.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await markPortraitSeen(id);
  return NextResponse.json({ ok: true });
}
