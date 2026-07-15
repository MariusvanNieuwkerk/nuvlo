import { NextResponse } from "next/server";
import { getDefaultChild, updateStoryIfLastChapterOpen } from "@/lib/storage";
import { nextScene, shouldGenerateFreshImage } from "@/lib/story-director";

// Fase A genereert de nieuwe hoofdstuktekst met het taalmodel (Anthropic). Dat kan 10–20s duren;
// zonder deze regel kapt Vercel de functie na de lage standaardlimiet (~10s) af en mislukt de
// keuze. Beeldwerk gebeurt apart in fase B (zie chapters/[n]/image). 60s = max op het Hobby-plan.
export const maxDuration = 60;

// Fout met HTTP-statuscode, gegooid vanuit de mutator in updateStoryIfLastChapterOpen.
// Scheidt "logic-fout" (400) van "AI-fout" (502) van "duplicaat" (geen fout, updated=false).
class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// FASE A van de gesplitste choice-flow. Deze request doet bewust GEEN beeldwerk: ze roept
// alleen Claude aan voor de nieuwe scène-tekst en slaat het hoofdstuk met alleen tekst op
// (imageUrl null, imagePending true). Zo verschijnt de leestekst
// vrijwel meteen (~10-20s i.p.v. minuten). Het beeldwerk — sinds de kosten-versobering nog maar
// één scène-illustratie per hoofdstuk — gebeurt daarna op de achtergrond via een apart endpoint
// (fase B: app/api/stories/[id]/chapters/[n]/image), terwijl het kind al leest.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  // Kan een van de aangeboden opties zijn, of een eigen getypt idee ("Verzin het zelf!") —
  // vandaar de ruime maar begrensde lengte-check in plaats van een vaste lijst.
  const choice = (body as { choice?: string } | null)?.choice?.trim().slice(0, 200);
  // Idempotentie-sleutel: het hoofdstuknummer waarop het kind deze keuze maakte (de client
  // stuurt dit mee). Zo herkennen we een dubbele inzending (snelle dubbele tik / refresh):
  // is dit hoofdstuk intussen al voortgezet, dan is de tweede POST een duplicaat en voegen we
  // GEEN tweede hoofdstuk toe. Ontbreekt het veld (oudere client), dan valt de logica terug op
  // de "laatste hoofdstuk"-controle hieronder.
  const fromChapter = (body as { fromChapter?: unknown } | null)?.fromChapter;
  const fromChapterN = typeof fromChapter === "number" ? fromChapter : null;

  if (!choice) {
    return NextResponse.json({ error: "Er ontbreekt een keuze." }, { status: 400 });
  }

  // Atomaire concurrentie: vroeger lib/locks.ts (in-process mutex), nu een conditionele
  // UPDATE in Postgres die alleen slaat als het laatste hoofdstuk nog geen `chosen` heeft
  // (zie updateStoryIfLastChapterOpen / de RPC append_chapter_atomic). Werkt op Vercel
  // serverless met meerdere instanties — twee gelijktijdige keuzes voor hetzelfde verhaal
  // leiden tot precies één nieuw hoofdstuk; de tweede aanvraag krijgt de verse staat terug.
  try {
    const result = await updateStoryIfLastChapterOpen(id, fromChapterN, async (story) => {
      if (story.status === "klaar") {
        throw new HttpError("Dit boek is al af.", 400);
      }

      const currentChapter = story.chapters[story.chapters.length - 1];
      if (!currentChapter || currentChapter.choices.length === 0) {
        throw new HttpError("Er is nu geen keuze te maken in dit verhaal.", 400);
      }

      currentChapter.chosen = choice;

      // Leeftijd van DIT boek (per-boek opgeslagen, zie story.authorAge) — niet de globale
      // "laatst gebruikte" leeftijd, want dat kan een ander kind zijn als er om de beurt
      // boeken gemaakt worden. Terugval op de globale rij alleen voor oudere boeken van
      // vóór authorAge bestond.
      const readingAge = story.authorAge ?? (await getDefaultChild()).age;

      let sceneResult;
      try {
        sceneResult = await nextScene({ story, choice, age: readingAge });
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Er ging iets mis bij het verhaal.";
        throw new HttpError(message, 502);
      }

      const chapter = { ...sceneResult.chapter };

      const useFreshImage = shouldGenerateFreshImage(story, sceneResult.isFinale, sceneResult.visuallyDistinctFromPrevious);

      chapter.sceneCharacterNames = sceneResult.sceneCharacters.map((c) => c.name);

      if (useFreshImage) {
        chapter.imageUrl = null;
        chapter.imageReused = false;
      } else {
        chapter.imageUrl = currentChapter.imageUrl;
        chapter.imageReused = true;
      }

      chapter.imagePending = useFreshImage;

      return {
        ...story,
        summary: sceneResult.summary,
        bible: sceneResult.bible,
        status: sceneResult.isFinale ? "klaar" : "bezig",
        chapters: [...story.chapters, chapter],
      };
    });

    if (!result.story) {
      return NextResponse.json({ error: "Verhaal niet gevonden." }, { status: 404 });
    }
    // Zowel updated=true (nieuw hoofdstuk) als updated=false (duplicaat) geven 200 met de
    // huidige staat — idempotent, precies zoals de client verwacht.
    return NextResponse.json({ story: result.story });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Er ging iets mis." }, { status: 500 });
  }
}
