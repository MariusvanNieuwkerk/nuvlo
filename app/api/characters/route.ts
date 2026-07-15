import { NextResponse } from "next/server";
import { getDefaultChild, listCharacters, saveCharacter } from "@/lib/storage";
import { getStory } from "@/lib/storage";
import { generateSideCharacterReferenceImage } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";
import { cleanSideCharacterAppearance } from "@/lib/appearance";
import type { SavedCharacter } from "@/lib/types";

// POST kan nu een fal.ai-aanroep doen (ankerbeeld voor een nieuw opgeslagen bijfiguur) — net
// als bij de andere routes die beeldgeneratie doen, is de standaard ~10s van Vercel te kort.
export const maxDuration = 60;

// GET /api/characters → lijst opgeslagen personages (hoofd- en bijfiguren) voor het
// ingelogde (default) kind. Wordt gebruikt door de "Mijn personages"-sectie op Home en door
// het held-formulier (kies een bestaande held).
export async function GET() {
  const child = await getDefaultChild();
  const characters = await listCharacters(child.id);
  return NextResponse.json({ characters });
}

// POST /api/characters → nieuw opgeslagen personage. Kan los aangemaakt worden, of vanuit
// een bestaand verhaal komen (body met `fromStoryId`): dan kopiëren we appearance/portret
// uit dat verhaal, zodat een nevenpersonage uit een boek herbruikbaar wordt als held.
//
// Body:
//   { name, kind: "hero"|"side", fromStoryId?, appearance?, imageStyleHint?, portraitUrl?,
//     seriesNote?, notes? }
// `fromStoryId` is de hoofdreden dat dit endpoint niet zomaar een create is: het haalt het
// gestructureerde uiterlijk EN het portret uit het bronverhaal, zodat we niet opnieuw een
// fal-call hoeven te doen voor het ankerbeeld — kostentechnisch de echte winst van hergebruik.
// Heeft een BIJFIGUUR na dat alles nog steeds geen portret (kwam nooit in een geïllustreerde
// scène voor), dan genereren we er hier alsnog één — anders zou hij voor altijd zonder foto
// in de bibliotheek blijven staan.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { name, kind, fromStoryId, appearance, imageStyleHint, portraitUrl, seriesNote, notes } =
    body as {
      name?: string;
      kind?: string;
      fromStoryId?: string;
      appearance?: unknown;
      imageStyleHint?: string;
      portraitUrl?: string | null;
      seriesNote?: string;
      notes?: string;
    };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Geef je personage een naam." }, { status: 400 });
  }
  if (kind !== "hero" && kind !== "side") {
    return NextResponse.json({ error: "Ongeldig soort personage." }, { status: 400 });
  }

  const child = await getDefaultChild();

  // Bronverhaal: kopiëren van appearance + portret + styleHint (de kostenefficiënte route).
  let resolvedAppearance: unknown = appearance;
  let resolvedImageStyleHint = imageStyleHint;
  let resolvedPortraitUrl = portraitUrl ?? null;

  if (fromStoryId) {
    const story = await getStory(fromStoryId);
    if (!story) {
      return NextResponse.json({ error: "Bronverhaal niet gevonden." }, { status: 404 });
    }
    if (kind === "hero") {
      // Een held opslaan vanuit een verhaal = de held van dat verhaal herbruikbaar maken.
      resolvedAppearance = story.character.appearance;
      resolvedImageStyleHint = resolvedImageStyleHint ?? story.character.imageStyleHint;
      resolvedPortraitUrl = resolvedPortraitUrl ?? story.character.portraitUrl;
    } else {
      // Een bijfiguur opslaan: zoek het nevenpersonage in de bible op naam.
      const side = story.bible.sideCharacters.find(
        (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (side) {
        resolvedAppearance = resolvedAppearance ?? side.appearance;
        resolvedPortraitUrl = resolvedPortraitUrl ?? side.referenceImageUrl;
      }
      resolvedImageStyleHint = resolvedImageStyleHint ?? story.character.imageStyleHint;
    }
  }

  if (!resolvedAppearance) {
    return NextResponse.json(
      { error: "Geef een uiterlijk mee, of een fromStoryId om het uit op te halen." },
      { status: 400 },
    );
  }

  // Een bijfiguur die zonder ankerbeeld in de bibliotheek terechtkomt (bv. omdat hij in zijn
  // bronverhaal nooit een geïllustreerde scène kreeg) zou anders VOOR ALTIJD zonder foto
  // blijven — niets triggert een generatie achteraf. Dit is dus het laatste, gegarandeerde
  // moment om er alsnog één te maken, quota toestaand.
  if (kind === "side" && !resolvedPortraitUrl) {
    const sideAppearance = cleanSideCharacterAppearance(resolvedAppearance);
    if (await tryClaimImageQuota(child.id)) {
      const ref = await generateSideCharacterReferenceImage(
        { name: name.trim(), appearance: sideAppearance, referenceImageUrl: null },
        resolvedImageStyleHint,
        null,
      );
      if (ref.url) {
        resolvedPortraitUrl = ref.url;
      } else {
        await releaseImageQuota(child.id);
      }
    }
  }

  const saved: SavedCharacter = await saveCharacter({
    childId: child.id,
    name: name.trim(),
    kind,
    appearance: resolvedAppearance,
    imageStyleHint: resolvedImageStyleHint,
    portraitUrl: resolvedPortraitUrl,
    seriesNote,
    notes,
    // Als het personage uit een verhaal komt, registreren we dat meteen in de audit-trail.
    sourceStoryIds: fromStoryId ? [fromStoryId] : [],
  });

  return NextResponse.json({ character: saved }, { status: 200 });
}
