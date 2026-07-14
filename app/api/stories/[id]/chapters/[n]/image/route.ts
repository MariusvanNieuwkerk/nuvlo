import { NextResponse } from "next/server";
import { getDefaultChild, getStory, updateChapterImageAtomic } from "@/lib/storage";
import { generateSceneImage } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";

// FASE B van de gesplitste choice-flow: het beeldwerk voor één hoofdstuk. De client roept dit
// endpoint aan direct nadat fase A (de choice-route) de nieuwe tekst heeft opgeslagen, zodat het
// plaatje op de achtergrond ontstaat terwijl het kind al leest.
//
// KOSTEN-AFWEGING (bewust versoberd): per hoofdstuk wordt hier MAXIMAAL ÉÉN fal-call gedaan —
// alleen de scène-illustratie, met het held-portret als enige (goedkope) consistentie-anker. De
// vroegere extra's op dit pad zijn VERWIJDERD (zie oude filegeschiedenis). Bij hergebruik
// (imageReused) of uitgeputte quota/fal-fout: 0 calls, dan verschijnt netjes de
// "geen tekening"-placeholder.
//
// CONCURRENTIE: vroeger lib/locks.ts (in-process mutex), nu een atomaire conditionele UPDATE
// in Postgres (updateChapterImageAtomic / RPC update_chapter_image_atomic) die alleen slaat
// als het hoofdstuk op dat moment nog imagePending=true heeft. Werkt op Vercel serverless met
// meerdere instanties — een dubbel-getriggerde fase B kan zo nooit twee fal-calls maken.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; n: string }> },
) {
  const { id, n: nRaw } = await params;
  const n = Number(nRaw);
  if (!Number.isInteger(n)) {
    return NextResponse.json({ error: "Ongeldig hoofdstuknummer." }, { status: 400 });
  }

  const story = await getStory(id);
  if (!story) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }

  const idx = story.chapters.findIndex((c) => c.n === n);
  if (idx === -1) {
    return NextResponse.json({ error: "Hoofdstuk niet gevonden." }, { status: 404 });
  }

  const chapter = story.chapters[idx];
  // Idempotent: niks meer te doen (beeld staat er al, of dit hoofdstuk heeft nooit
  // achtergrondwerk gehad). Dubbele fetch of een herhaalde refresh kan zo geen kwaad.
  if (!chapter.imagePending) {
    return NextResponse.json({ story });
  }

  const child = await getDefaultChild();
  const bible = story.bible;
  const character = story.character;

  // De nevenpersonages in deze scène gebruiken we alleen nog voor hun TEKST-beschrijving in
  // de prompt (gratis). Hun aparte ankerBEELDEN maken we niet meer aan, dus strippen we een
  // eventueel (uit oudere data) aanwezige referenceImageUrl: op het runtime-pad is het
  // held-portret het enige referentiebeeld — één anker, één call.
  const sceneCharacters = bible.sideCharacters
    .filter((c) =>
      (chapter.sceneCharacterNames ?? []).some((name) => name.toLowerCase() === c.name.toLowerCase()),
    )
    .map((c) => ({ ...c, referenceImageUrl: null }));

  // Reused chapter houdt het vorige plaatje; een verse scène begint zonder beeld.
  let sceneImageUrl: string | null = chapter.imageUrl;

  // Alleen bij een verse scène is er echt teken-werk: bij hergebruik (imageReused) staat het
  // beeld al klaar en slaan we dit hele blok over (dat scheelt fal.ai- én quota-kosten).
  if (!chapter.imageReused) {
    // Harde daglimiet: is de quota op, dan claimt dit niets, doen we GEEN fal-call en blijft
    // sceneImageUrl null → de lees-UI toont de "geen tekening"-placeholder.
    if (await tryClaimImageQuota(child.id)) {
      // Één scène-illustratie, met alléén het held-portret als referentie-anker. Faalt de
      // fal-call (bv. 403/geen tegoed) → url null, quota teruggeven.
      const scene = await generateSceneImage(
        chapter.imagePrompt,
        character.appearance,
        character.imageStyleHint,
        bible.worldAppearance,
        sceneCharacters,
        character.portraitUrl,
        null,
      );
      if (scene.url) {
        sceneImageUrl = scene.url;
      } else {
        await releaseImageQuota(child.id);
      }
    }
  }

  // Atomaire write-back: alleen schrijven als het hoofdstuk intussen nog imagePending=true
  // heeft (iemand anders was ons net voor → 0 rijen → verse staat teruglezen en tonen).
  const updated = await updateChapterImageAtomic(id, n, sceneImageUrl);
  if (!updated) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ story: updated });
}
