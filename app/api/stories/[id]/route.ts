import { NextResponse } from "next/server";
import { deleteStory, setStoryFavorite, updateStoryTitle } from "@/lib/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const removed = await deleteStory(id);
  if (!removed) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { favorite, title } = (body as { favorite?: unknown; title?: unknown } | null) ?? {};

  if (typeof favorite !== "boolean" && typeof title !== "string") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  // Beide velden kunnen apart of samen meekomen — favoriet-toggle en titel-bewerken raken
  // elkaar niet, dus we passen alleen toe wat er echt meegegeven is.
  let story = null;
  if (typeof favorite === "boolean") {
    story = await setStoryFavorite(id, favorite);
  }
  if (typeof title === "string") {
    if (!title.trim()) {
      return NextResponse.json({ error: "Geef het boek een titel." }, { status: 400 });
    }
    story = await updateStoryTitle(id, title);
  }

  if (!story) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ story });
}
