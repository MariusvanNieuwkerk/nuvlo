import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  createStory,
  getCharacter,
  getDefaultChild,
  getStory,
  registerStoryForCharacter,
  saveCharacter,
  saveStory,
  updateDefaultChild,
} from "@/lib/storage";
import { startStory } from "@/lib/story-director";
import { generatePortrait } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";
import { getImageStyle } from "@/lib/image-styles";
import { fillHeroDefaults } from "@/lib/hero-defaults";
import { cleanChildOutline, outlineHasContent } from "@/lib/story-outline";
import type { Genre, Hero, SideCharacter } from "@/lib/types";

// Starten doet alleen Claude (tekst). Plaatjes komen erna. Zonder maxDuration kapt Vercel
// de functie na ~10s af. 60s is het maximum op het Hobby-plan.
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

  const { hero, age, authorName, appearance, styleId, existingCharacterId, existingSideCharacterIds, outline: rawOutline } =
    body as {
      hero?: Partial<Hero>;
      age?: number;
      authorName?: string;
      appearance?: string;
      styleId?: string;
      existingCharacterId?: string;
      existingSideCharacterIds?: string[];
      outline?: unknown;
    };
  const outline = cleanChildOutline(rawOutline);

  if (
    !hero ||
    !hero.name?.trim() ||
    !hero.world?.trim() ||
    !hero.genre ||
    !VALID_GENRES.includes(hero.genre) ||
    typeof age !== "number" ||
    age < 4 ||
    age > 14 ||
    !authorName?.trim()
  ) {
    return NextResponse.json(
      { error: "Vul je naam en leeftijd in, en kies een held, wereld en genre (leeftijd tussen 4 en 14)." },
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

  const child = await getDefaultChild();
  await updateDefaultChild(authorName, age);

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

  // Skills van de held winnen van een genre-default. Leeg = Claude krijgt een vriendelijke
  // standaardkracht, zodat het verhaal wél houvast heeft.
  const childSkills = existingCharacter?.skills?.trim() || hero.power?.trim() || undefined;
  const fullHero: Hero = fillHeroDefaults({
    name: hero.name,
    world: hero.world,
    genre: hero.genre,
    power: childSkills,
    weakness: hero.weakness,
    enemy: outline.enemy || hero.enemy,
  });

  // Nevenpersonages die het kind expliciet koos om in dit boek te laten terugkeren (los van de
  // held-keuze hierboven — je mag dus tegelijk een held ÉN één of meer bijfiguren kiezen). Een
  // ID dat niet meer bestaat (bv. net verwijderd) slaan we stil over — dat mag de rest van het
  // aanmaken niet blokkeren. Dezelfde held mag niet ook als bijfiguur meegegeven worden.
  const sideCharacterIds = Array.from(
    new Set((existingSideCharacterIds ?? []).filter((id) => id && id !== existingCharacterId)),
  );
  const existingSideSavedCharacters = (
    await Promise.all(sideCharacterIds.map((id) => getCharacter(id)))
  ).filter((c): c is NonNullable<typeof c> => Boolean(c));
  // Stijl hoort bij de held: bestaande held → bibliotheekstijl. Nieuwe held → gekozen tegel.
  const chosenStyle = existingCharacter ? undefined : getImageStyle(styleId);
  const storyStyleHint = existingCharacter?.imageStyleHint ?? chosenStyle?.imageStyleHint;
  // Vertaal naar het SideCharacter-formaat. Het paspoort-plaatje gaat ALTIJD mee —
  // weggooien omdat de stijl anders is, liet het model een nieuw wezen verzinnen.
  const existingSideCharacters: SideCharacter[] = existingSideSavedCharacters.map((c) => ({
    name: c.name,
    appearance: {
      freeform: c.appearance.freeform,
      distinguishingFeature: c.appearance.distinguishingFeature,
    },
    referenceImageUrl: c.portraitUrl ?? null,
  }));

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
            skills: existingCharacter.skills,
          }
        : undefined,
      lockedSkills: childSkills,
      existingSideCharacters: existingSideCharacters.length > 0 ? existingSideCharacters : undefined,
      imageStyleHint: storyStyleHint,
      outline: outlineHasContent(outline) ? outline : undefined,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Er is iets misgegaan bij het maken van het verhaal.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Eerst alleen tekst opslaan, plaatjes erna (zoals bij verder lezen). Anders duurt
  // starten te lang (Claude + meerdere tekeningen) en kapt Vercel de request af.
  const chapter = { ...result.chapter };
  chapter.imageUrl = null;
  chapter.imagePending = true;
  chapter.sceneCharacterNames = result.sceneCharacters.map((c) => c.name);
  const character = { ...result.character };
  if (existingCharacter) {
    character.imageStyleHint = existingCharacter.imageStyleHint;
    if (existingCharacter.portraitUrl) {
      character.portraitUrl = existingCharacter.portraitUrl;
    }
  } else if (chosenStyle) {
    character.imageStyleHint = chosenStyle.imageStyleHint;
  }

  const bible = { ...result.bible };

  const story = await createStory({
    childId: child.id,
    title: result.title,
    authorName: authorName.trim(),
    authorAge: age,
    hero: fullHero,
    character,
    bible,
    summary: result.summary,
    status: "bezig",
    chapters: [chapter],
    coverUrl: null,
    favorite: false,
  });

  // Audit-trail bijwerken: dit verhaal gebruikt nu de opgeslagen held, en/of de gekozen
  // bijfiguren. Idempotent — een per ongeluk dubbele aanroep voegt het storyId maar één keer toe.
  if (existingCharacter) {
    await registerStoryForCharacter(existingCharacter.id, story.id);
  }
  let newHeroId: string | null = null;
  if (!existingCharacter) {
    const savedHero = await saveCharacter({
      childId: child.id,
      name: fullHero.name,
      kind: "hero",
      appearance: character.appearance,
      imageStyleHint: character.imageStyleHint,
      portraitUrl: character.portraitUrl,
      sourceStoryIds: [story.id],
      skills: childSkills,
    });
    newHeroId = savedHero.id;
  }
  await Promise.all(sideCharacterIds.map((id) => registerStoryForCharacter(id, story.id)));

  // Portret van een nieuwe held ná het antwoord, zodat starten niet weer vastloopt.
  if (!story.character.portraitUrl) {
    const storyId = story.id;
    const childId = child.id;
    const heroIdToUpdate = newHeroId;
    after(async () => {
      try {
        if (!(await tryClaimImageQuota(childId))) return;
        const fresh = await getStory(storyId);
        if (!fresh || fresh.character.portraitUrl) {
          await releaseImageQuota(childId);
          return;
        }
        const portrait = await generatePortrait(
          fresh.character.appearance,
          "het avontuur begint net",
          fresh.character.imageStyleHint,
        );
        if (!portrait.url) {
          await releaseImageQuota(childId);
          return;
        }
        const latest = await getStory(storyId);
        if (!latest) return;
        await saveStory({
          ...latest,
          character: { ...latest.character, portraitUrl: portrait.url },
        });
        if (heroIdToUpdate) {
          const savedHero = await getCharacter(heroIdToUpdate);
          if (savedHero && !savedHero.portraitUrl) {
            await saveCharacter({
              id: savedHero.id,
              childId: savedHero.childId,
              name: savedHero.name,
              kind: savedHero.kind,
              appearance: savedHero.appearance,
              imageStyleHint: savedHero.imageStyleHint,
              portraitUrl: portrait.url,
              sourceStoryIds: savedHero.sourceStoryIds,
              seriesNote: savedHero.seriesNote,
              notes: savedHero.notes,
              skills: savedHero.skills,
            });
          }
        }
      } catch (err) {
        console.error("Achtergrond-portret mislukt:", err);
      }
    });
  }

  return NextResponse.json({ story }, { status: 201 });
}
