import { NextResponse } from "next/server";
import { recordStoryOpened } from "@/lib/storage";

// Minimale leessignaal-meting: de lees-/boekpagina roept dit één keer aan zodra het kind een
// boek daadwerkelijk opent om te lezen (zie components/book-pager.tsx). Bewust zonder body,
// idempotent-vriendelijk en "fire and forget" — dit mag de leeservaring nooit vertragen of
// blokkeren, dus de aanroeper wacht hier ook niet op en negeert een eventuele fout.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await recordStoryOpened(id);
  return NextResponse.json({ ok: true });
}
