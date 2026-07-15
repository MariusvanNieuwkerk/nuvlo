import { NextResponse } from "next/server";
import {
  getDefaultChild,
  getStory,
  reopenChapterImagePending,
  updateChapterImageAtomic,
} from "@/lib/storage";
import { generateSceneImage } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";
import { ensureSceneCharacterReferences } from "@/lib/side-character-images";

// Het tekenmodel (fal.ai / nano-banana-2) doet vaak 20–60s over één illustratie. Zonder deze
// regel kapt Vercel de functie al na de lage standaardlimiet (~10s) af: de fal-call is dan nog
// niet klaar, er wordt niets teruggeschreven en het hoofdstuk blijft eeuwig op imagePending=true
// hangen ("De tekening wordt gemaakt…" die nooit verschijnt). 60s is het maximum op het
// Hobby-plan en ruim genoeg voor één illustratie.
export const maxDuration = 60;

// FASE B van de gesplitste choice-flow: het beeldwerk voor één hoofdstuk. De client roept dit
// endpoint aan direct nadat fase A (de choice-route) de nieuwe tekst heeft opgeslagen, zodat het
// plaatje op de achtergrond ontstaat terwijl het kind al leest.
//
// KOSTEN-AFWEGING: per hoofdstuk wordt hier het held-portret altijd als (goedkoop, want
// hergebruikt) consistentie-anker meegegeven. Komt een nevenpersonage voor het EERST in beeld,
// dan kost dat éénmalig een extra fal-call voor zijn eigen ankerbeeld (via
// ensureSceneCharacterReferences) — daarna is dat anker voor de rest van het boek gratis
// herbruikbaar, precies zoals het held-portret. Bij hergebruik (imageReused) of uitgeputte
// quota/fal-fout: geen extra calls, dan verschijnt netjes de "geen tekening"-placeholder.
//
// CONCURRENTIE: vroeger lib/locks.ts (in-process mutex), nu een atomaire conditionele UPDATE
// in Postgres (updateChapterImageAtomic / RPC update_chapter_image_atomic) die alleen slaat
// als het hoofdstuk op dat moment nog imagePending=true heeft. Werkt op Vercel serverless met
// meerdere instanties — een dubbel-getriggerde fase B kan zo nooit twee fal-calls maken.
//
// FORCE RETRY: body `{ force: true }` heropent een mislukte scène (imageUrl null, pending
// al false) zodat de "Probeer opnieuw"-knop in de lees-UI alsnog een echte tekening kan
// aanvragen — bv. nadat de dagquota weer ruimte heeft.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; n: string }> },
) {
  const { id, n: nRaw } = await params;
  const n = Number(nRaw);
  if (!Number.isInteger(n)) {
    return NextResponse.json({ error: "Ongeldig hoofdstuknummer." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const force = Boolean(body && typeof body === "object" && (body as { force?: unknown }).force);

  let story = await getStory(id);
  if (!story) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }

  let idx = story.chapters.findIndex((c) => c.n === n);
  if (idx === -1) {
    return NextResponse.json({ error: "Hoofdstuk niet gevonden." }, { status: 404 });
  }

  let chapter = story.chapters[idx];

  // Handmatige retry: scène opnieuw in de wachtrij zetten als er nog geen plaatje is.
  if (force && !chapter.imageUrl && !chapter.imagePending) {
    const reopened = await reopenChapterImagePending(id, n);
    if (!reopened) {
      return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
    }
    story = reopened;
    idx = story.chapters.findIndex((c) => c.n === n);
    chapter = story.chapters[idx];
  }

  // Idempotent: niks meer te doen (beeld staat er al, of dit hoofdstuk heeft nooit
  // achtergrondwerk gehad). Dubbele fetch of een herhaalde refresh kan zo geen kwaad.
  if (!chapter.imagePending) {
    return NextResponse.json({ story });
  }

  const child = await getDefaultChild();
  const bible = story.bible;
  const character = story.character;

  // De nevenpersonages die Claude aangaf dat écht in DEZE scène te zien zijn.
  const sceneCharactersInScene = bible.sideCharacters.filter((c) =>
    (chapter.sceneCharacterNames ?? []).some((name) => name.toLowerCase() === c.name.toLowerCase()),
  );

  // Reused chapter houdt het vorige plaatje; een verse scène begint zonder beeld.
  let sceneImageUrl: string | null = chapter.imageUrl;
  // Alleen ingevuld als er tijdens deze aanroep echt teken-werk gebeurde — dan slaan we de
  // (mogelijk met een nieuw nevenpersonage-anker bijgewerkte) bible mee op.
  let updatedBible: typeof bible | undefined;

  // Alleen bij een verse scène is er echt teken-werk: bij hergebruik (imageReused) staat het
  // beeld al klaar en slaan we dit hele blok over (dat scheelt fal.ai- én quota-kosten).
  //
  // Alles hierbinnen staat bewust in een try/catch: gebeurt er ONVERWACHT iets mis (een bug,
  // een timeout, een onverwachte fal.ai-respons) dan MAG het hoofdstuk nooit voor altijd op
  // imagePending=true blijven staan — dat gaf precies het "de tekening wordt gemaakt…" dat
  // nooit verscheen en zonder herstelmogelijkheid was. We loggen de fout, laten sceneImageUrl
  // dan gewoon null, en gaan altijd door naar de write-back hieronder.
  if (!chapter.imageReused) {
    // Bijhouden of de quota-claim voor DEZE scène-illustratie al gelukt is, zodat de catch
    // hieronder — bij een onverwachte fout na het claimen — die plek altijd teruggeeft. Zonder
    // dit lekte een geclaimde plek stilletjes weg bij elke onverwachte fout ná het claimen,
    // wat de dag-quota vult zonder dat er ooit een tekening voor terugkwam.
    let quotaClaimedForScene = false;
    try {
      // Zorg dat elk nevenpersonage in déze scène een ankerbeeld heeft (maakt er hooguit één
      // per nog-onbekend personage aan, met quota-bescherming — zie lib/side-character-images.ts).
      const refs = await ensureSceneCharacterReferences(
        child.id,
        bible.sideCharacters,
        sceneCharactersInScene,
        character.imageStyleHint,
      );
      updatedBible = { ...bible, sideCharacters: refs.registry };

      // Harde daglimiet: is de quota op, dan claimt dit niets, doen we GEEN fal-call en blijft
      // sceneImageUrl null → de lees-UI toont de "geen tekening"-placeholder.
      quotaClaimedForScene = await tryClaimImageQuota(child.id);
      if (quotaClaimedForScene) {
        // Scène-illustratie met het held-portret én de zojuist opgehaalde/aangemaakte
        // nevenpersonage-ankers als referentie. Faalt de fal-call (bv. 403/geen tegoed) →
        // url null, quota teruggeven.
        const scene = await generateSceneImage(
          chapter.imagePrompt,
          character.appearance,
          character.imageStyleHint,
          bible.worldAppearance,
          refs.sceneCharacters,
          character.portraitUrl,
          null,
          chapter.heroTemporaryAppearance,
        );
        if (scene.url) {
          sceneImageUrl = scene.url;
        } else {
          await releaseImageQuota(child.id);
          quotaClaimedForScene = false;
        }
      }
    } catch (err) {
      console.error("Onverwachte fout tijdens illustratie-generatie:", err);
      sceneImageUrl = null;
      if (quotaClaimedForScene) {
        await releaseImageQuota(child.id).catch(() => {});
      }
    }
  }

  // Atomaire write-back: alleen schrijven als het hoofdstuk intussen nog imagePending=true
  // heeft (iemand anders was ons net voor → 0 rijen → verse staat teruglezen en tonen).
  const updated = await updateChapterImageAtomic(id, n, sceneImageUrl, updatedBible);
  if (!updated) {
    return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ story: updated });
}
