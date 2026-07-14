import { NextResponse } from "next/server";
import { deleteStory, setStoryFavorite } from "@/lib/storage";

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
  const favorite = (body as { favorite?: unknown } | null)?.favorite;

  if (typeof favorite !== "boolean") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const story = await setStoryFavorite(id, favorite);
  if (!story) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ story });
}
