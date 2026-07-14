import { NextResponse } from "next/server";
import {
  createStory,
  getCharacter,
  getDefaultChild,
  registerStoryForCharacter,
  updateDefaultChildAge,
} from "@/lib/storage";
import { startStory } from "@/lib/story-director";
import { generateSceneImage, generatePortrait } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";
import { getImageStyle } from "@/lib/image-styles";
import type { Genre, Hero } from "@/lib/types";

// Een nieuw verhaal aanmaken doet het meeste AI-werk in één request: tekst-generatie én
// meerdere fal.ai-beeldcalls (held-portret, omslag én de eerste scène-illustratie). Dat duurt
// makkelijk tientallen seconden; zonder deze regel kapt Vercel de functie na ~10s af en mislukt
// het aanmaken. 60s is het maximum op het Hobby-plan.
export const maxDuration = 60;

const VALID_GENRES: Genre[] = [
  "avontuur",
  "fantasie",
  "ruimte",
  "onderwater",
  "dieren",
  "detective",
];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { hero, age, appearance, styleId, existingCharacterId } = body as {
    hero?: Partial<Hero>;
    age?: number;
    appearance?: string;
    styleId?: string;
    existingCharacterId?: string;
  };

  if (
    !hero ||
    !hero.name?.trim() ||
    !hero.world?.trim() ||
    !hero.power?.trim() ||
    !hero.weakness?.trim() ||
    !hero.enemy?.trim() ||
    !hero.genre ||
    !VALID_GENRES.includes(hero.genre) ||
    typeof age !== "number" ||
    age < 4 ||
    age > 14
  ) {
    return NextResponse.json(
      { error: "Vul alle velden over je held in (leeftijd tussen 4 en 14)." },
      { status: 400 },
    );
  }

  // appearance is alleen verplicht als we geen bestaande held hergebruiken — in dat geval
  // levert de personagens-bibliotheek de appearance.
  const hasExisting = Boolean(existingCharacterId);
  if (!hasExisting && !appearance?.trim()) {
    return NextResponse.json(
      { error: "Beschrijf hoe je held eruitziet." },
      { status: 400 },
    );
  }

  const fullHero: Hero = {
    name: hero.name.trim(),
    world: hero.world.trim(),
    power: hero.power.trim(),
    weakness: hero.weakness.trim(),
    enemy: hero.enemy.trim(),
    genre: hero.genre,
  };

  const child = await getDefaultChild();
  await updateDefaultChildAge(age);

  // Hergebruik-route: een bestaande held uit de personagens-bibliotheek. We laden het
  // opgeslagen personage en geven appearance + styleHint mee aan startStory — dan verzint
  // Claude het uiterlijk niet opnieuw. Het portret (portraitUrl) mag hergebruikt worden,
  // wat een fal-call scheelt (het tegoed is krap).
  let existingCharacter: Awaited<ReturnType<typeof getCharacter>> = null;
  if (existingCharacterId) {
    existingCharacter = await getCharacter(existingCharacterId);
    if (!existingCharacter) {
      return NextResponse.json(
        { error: "Gekozen personage niet gevonden." },
        { status: 404 },
      );
    }
  }

  // appearance-tekst is alleen verplicht wanneer we geen bestaande held hergebruiken — in
  // dat geval levert de bibliotheek de appearance. Voor de prompt maken we een lege string
  // als fallback; existingCharacter.appearance.freeform wordt door startStory afzonderlijk
  // meegenomen via de appearanceNote.
  const appearanceText = appearance?.trim() ?? existingCharacter?.appearance.freeform ?? "";

  let result;
  try {
    result = await startStory({
      hero: fullHero,
      age,
      appearance: appearanceText,
      existingCharacter: existingCharacter
        ? {
            appearance: existingCharacter.appearance,
            imageStyleHint: existingCharacter.imageStyleHint,
            name: existingCharacter.name,
          }
        : undefined,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Er ging iets mis bij het maken van het verhaal.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Directe beloning: de illustratie van de openingsscène meteen tonen. Plus het eerste
  // held-portret — dat mag meteen zichtbaar zijn, dat is nog geen "uitgestelde" beloning,
  // maar simpelweg het resultaat van het net gekozen uiterlijk.
  const chapter = { ...result.chapter };
  const character = { ...result.character };

  // De expliciet gekozen tekenstijl-tegel is altijd betrouwbaarder dan Claude's eigen
  // inschatting (zie lib/image-styles.ts) — die blijft alleen als terugval bestaan voor
  // wanneer styleId onverwacht ontbreekt of ongeldig is. Bij hergebruik van een opgeslagen
  // held moet de stijl van de bibliotheek het echter ALTIJD winnen (vast uiterlijk hoort
  // bij een vaste stijl) — daarom overschrijven we existingCharacter.imageStyleHint pas
  // ná het gekozen styleId, zodat de tegel-keuze van het kind (die tijdens hergebruik
  // expliciet voor-gevuld staat op de stijl van de held) niet per ongeluk weer vervlakt.
  const chosenStyle = getImageStyle(styleId);
  if (chosenStyle) {
    character.imageStyleHint = chosenStyle.imageStyleHint;
  }
  if (existingCharacter) {
    character.imageStyleHint = existingCharacter.imageStyleHint;
  }

  const bible = { ...result.bible };

  // KOSTEN-AFWEGING bij het aanmaken: maximaal TWEE fal-calls i.p.v. de oude 4-6.
  // 1) het held-portret (het goedkope consistentie-anker), en 2) de openingsscène met dat
  // portret als enige referentie. Het wereld-referentiebeeld en de nevenpersonage-ankers zijn
  // hier VERWIJDERD (kostten elk een aparte call), net als de vision-verify-retries.
  // De cover wordt niet apart gegenereerd maar HERGEBRUIKT de openingsscène-illustratie — dat
  // scheelt nog een call, en de boekenplank toont die kaart toch in 4:3, precies het formaat
  // van de scène. Lukt de scène niet (geen quota / fal-fout), dan blijft coverUrl null en valt
  // de boekenplank terug op de vaste genre-kleur.
  //
  // HERGEBRUIK-ROUTE: bij een bestaande held hebben we al een portret in de bibliotheek —
  // dat nemen we direct over (geen fal-call voor het portret). Dat scheelt precies één call
  // per nieuw boek met een bekende held, en het portret blijft visueel consistent tussen
  // boeken in dezelfde "reeks".
  if (existingCharacter?.portraitUrl) {
    character.portraitUrl = existingCharacter.portraitUrl;
  } else if (await tryClaimImageQuota(child.id)) {
    const portrait = await generatePortrait(character.appearance, "het avontuur begint net", character.imageStyleHint);
    character.portraitUrl = portrait.url;
    if (!portrait.url) await releaseImageQuota(child.id);
  }

  // Nevenpersonages die al in de openingsscène voorkomen gaan alleen als TEKST mee (gratis);
  // hun aparte ankerbeelden maken we niet meer aan — het held-portret is het enige beeld-anker.
  const sceneCharacters = result.sceneCharacters;

  if (await tryClaimImageQuota(child.id)) {
    const scene = await generateSceneImage(
      chapter.imagePrompt,
      character.appearance,
      character.imageStyleHint,
      bible.worldAppearance,
      sceneCharacters,
      character.portraitUrl,
      null,
    );
    chapter.imageUrl = scene.url;
    if (!scene.url) await releaseImageQuota(child.id);
  }

  // Cover = de openingsscène-illustratie hergebruiken (geen extra fal-call).
  const coverUrl: string | null = chapter.imageUrl;

  const story = await createStory({
    childId: child.id,
    title: result.title,
    hero: fullHero,
    character,
    bible,
    summary: result.summary,
    status: "bezig",
    chapters: [chapter],
    coverUrl,
    favorite: false,
  });

  // Audit-trail bijwerken: dit verhaal gebruikt nu de opgeslagen held. Idempotent — een
  // per ongeluk dubbele aanroep voegt het storyId maar één keer toe.
  if (existingCharacter) {
    await registerStoryForCharacter(existingCharacter.id, story.id);
  }

  return NextResponse.json({ story }, { status: 201 });
}
