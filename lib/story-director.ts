// De verhaalregisseur. Dit is het hart van de app.
//
// FASE 1 (was): een sjabloon-generator, geen AI.
// FASE 2 (nu): startStory() en nextScene() roepen Claude aan via Anthropic's tool-use
// (structured output), zodat we altijd betrouwbare, geldige JSON terugkrijgen. De rest
// van de app (routes, schermen) roept alleen deze twee functies aan en verandert niet —
// wel zijn ze nu async, dus de routes doen er een "await" bij.
//
// FASE 3 (later): hier wordt de system-prompt en de gebruikersboodschap verder getuned
// op basis van uitgespeelde verhalen (cliffhangers die echt trekken, keuzes die
// leesbegrip vereisen, draadjes die netjes terugkomen).

import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/ai/client";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { START_STORY_TOOL, NEXT_SCENE_TOOL } from "@/lib/ai/tools";
import {
  cleanCharacterAppearance,
  cleanSideCharacterAppearance,
  cleanWorldAppearance,
  describeCharacterAppearance,
  describeWorldAppearance,
  type CharacterAppearance,
} from "@/lib/appearance";
import type { Chapter, CharacterSheet, Hero, SideCharacter, Story, StoryBible } from "@/lib/types";
import { CHAPTERS_TARGET } from "@/lib/progress";

// Eén gedeelde bron voor het richtgetal (zie lib/progress.ts) — zo kunnen de pacing/finale-
// logica hier en de kindvriendelijke voortgangsbalk nooit uit elkaar lopen.
export const CHAPTERS_TOTAL = CHAPTERS_TARGET; // Richtlijn: het verhaal rondt hier ongeveer af.
const HARD_CHAPTER_LIMIT = CHAPTERS_TOTAL + 4; // Veiligheidsgrens tegen een verhaal dat nooit afrondt.

export type StartStoryInput = {
  hero: Hero;
  age: number;
  appearance: string;
  // Optioneel: een reeds bestaande held uit de personagens-bibliotheek. Indien meegegeven
  // wordt het uiterlijk NIET opnieuw door Claude verzonnen — we gebruiken deze appearance +
  // styleHint als vaste basis voor character.appearance en character.imageStyleHint. De
  // overige held-velden (wereld, kracht, zwakte, tegenstander, genre) blijven per-verhaal
  // vrij en worden via `hero` meegegeven. Zie lib/story-director.ts:startStory.
  existingCharacter?: {
    appearance: CharacterAppearance;
    imageStyleHint: string;
    name: string;
  };
};

export type StartStoryResult = {
  title: string;
  bible: StoryBible;
  character: CharacterSheet;
  summary: string;
  chapter: Chapter;
  sceneCharacters: SideCharacter[]; // nevenpersonages die in déze scène te zien zijn, voor de illustratie
};

export type NextSceneInput = {
  story: Story;
  choice: string;
  age: number;
};

export type NextSceneResult = {
  chapter: Chapter;
  summary: string;
  bible: StoryBible;
  isFinale: boolean;
  sceneCharacters: SideCharacter[]; // nevenpersonages die in déze scène te zien zijn, voor de illustratie
  // Claude's eigen inschatting of deze scène visueel genoeg verschilt van de vorige
  // illustratie om een nieuwe, betaalde generatie te verdienen — zie shouldGenerateFreshImage.
  visuallyDistinctFromPrevious: boolean;
  // True als de scène naar een wézenlijk andere plek verhuist (bv. van open sterrenhemel
  // naar een donkere grot), zodat het ene vaste wereld-ankerbeeld niet meer klopt. Alleen
  // dan wordt er een nieuw wereld-referentiebeeld gemaakt (kostbaar → bewust zeldzaam).
  // Zie de route: bible.worldAppearance is dan al bijgewerkt naar de nieuwe locatie.
  newLocation: boolean;
};

// `characterAppearance`/`worldAppearance`/`sideCharacters[].appearance` komen als ruwe,
// nog ongevalideerde objecten terug van Claude — vandaar `unknown` hier en het
// opschonen via cleanCharacterAppearance/cleanWorldAppearance/cleanSideCharacterAppearance
// verderop, in plaats van de tool-output blind te vertrouwen als het juiste type.
type StartStoryToolOutput = {
  title: string;
  aktes: string[];
  openThreads: string[];
  summary: string;
  characterAppearance: unknown;
  imageStyleHint: string;
  pages: unknown; // array van leesbladzijden, nog ongevalideerd → opschonen via cleanStringArray
  choices: string[];
  imagePrompt: string;
  worldAppearance: unknown;
  sideCharacters: { name?: unknown; appearance?: unknown }[];
  charactersInScene: string[];
};

type NextSceneToolOutput = {
  pages: unknown; // array van leesbladzijden, nog ongevalideerd → opschonen via cleanStringArray
  choices: string[];
  summary: string;
  openThreads: string[];
  imagePrompt: string;
  isFinale: boolean;
  visuallyDistinctFromPrevious: boolean;
  newLocation?: boolean;
  newLocationAppearance?: unknown; // alleen ingevuld door Claude als newLocation true is
  sideCharacters: { name?: unknown; appearance?: unknown }[];
  charactersInScene: string[];
};

function readingLevelLabel(age: number): string {
  if (age <= 7) return "6-7 jaar: zeer korte, simpele zinnen (AVI M3/E3-niveau)";
  if (age <= 9) return "8-9 jaar: korte zinnen (AVI M5/E5-niveau)";
  return "10 jaar of ouder: vlotte, iets rijkere zinnen";
}

function expectedAkte(chapterN: number): number {
  return Math.min(5, Math.ceil(chapterN / 3));
}

// De twee grote verhaalbeats (ruwweg einde akte 2 en einde akte 4) waarop het held-portret
// een update krijgt. Eén gedeelde berekening zodat dat altijd op een logisch verhaalmoment valt.
export function milestoneChapters(): [number, number] {
  return [Math.round(CHAPTERS_TOTAL / 3), Math.round((CHAPTERS_TOTAL * 2) / 3)];
}

// Op welke hoofdstukken het held-portret (de uitgestelde beloning) een update krijgt:
// ruwweg bij het einde van akte 2 en akte 4, plus altijd bij de finale.
export function isPortraitMilestone(chapterN: number, isFinale: boolean): boolean {
  if (isFinale) return true;
  const [first, second] = milestoneChapters();
  return chapterN === first || chapterN === second;
}

// Hoeveel hoofdstukken op rij (tellend vanaf het laatste) een hergebruikte illustratie
// hadden. Een ontbrekend imageReused-veld (oudere hoofdstukken) telt als "vers gegenereerd"
// — zie Chapter.imageReused — dus die stoppen de telling altijd, ook bij oude data.
// Verlaagd van 2 naar 1: op de goedkopere "lite"-beeldmodellen (zie lib/image.ts) is een
// extra plaatje nog maar een paar cent, en "de afbeeldingen komen niet overeen met het
// verhaal" bleek deels hierdoor te komen — Claude's eigen visuallyDistinctFromPrevious-
// inschatting is niet perfect, dus hoe minder hoofdstukken we op die inschatting laten
// hergebruiken, hoe kleiner het risico op een duidelijk verkeerd/oud plaatje.
const MAX_CONSECUTIVE_IMAGE_SKIPS = 1;

function consecutiveImageSkipStreak(chapters: Chapter[]): number {
  let streak = 0;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (!chapters[i].imageReused) break;
    streak++;
  }
  return streak;
}

// De kernbeslissing van de "sla overslaanbare plaatjes over"-functie: mag dit hoofdstuk
// het vorige illustratie hergebruiken, of moet er echt een nieuwe (betaalde) gegenereerd
// worden? `story` is het verhaal ZOALS HET WAS vóór dit nieuwe hoofdstuk (dus de
// skip-streak van de al opgeslagen hoofdstukken, exclusief het hoofdstuk dat we nu
// beoordelen).
//
// Drie manieren om een verse illustratie te forceren, ongeacht Claude's eigen inschatting:
// 1. De finale — het belangrijkste moment om echt af te sluiten met een nieuw beeld.
// 2. Claude zelf gaf aan dat de scène visueel genoeg verschilt.
// 3. De vloer: nooit meer dan MAX_CONSECUTIVE_IMAGE_SKIPS hoofdstukken op rij overslaan,
//    ook niet als Claude drie keer achter elkaar "niet anders genoeg" zegt — anders zou een
//    kind te lang naar precies hetzelfde plaatje kunnen blijven kijken.
export function shouldGenerateFreshImage(
  story: Story,
  isFinale: boolean,
  visuallyDistinctFromPrevious: boolean,
): boolean {
  if (isFinale) return true;
  if (visuallyDistinctFromPrevious) return true;
  return consecutiveImageSkipStreak(story.chapters) >= MAX_CONSECUTIVE_IMAGE_SKIPS;
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    // Nooit de interne veldnaam aan het kind tonen — vertaal naar een begrijpelijke melding.
    throw new Error("Het verhaal kon niet goed gemaakt worden. Probeer het nog eens.");
  }
  return value.trim();
}

// Soms levert Claude een leeg/ontbrekend imagePrompt op (bv. een zeldzame hallucinatie of een
// antwoord dat nét iets anders indeelt). Dat is géén reden om het hele hoofdstuk te laten
// falen — imagePrompt gaat alleen over de tekening, niet over de leestekst. In dat geval
// bouwen we hier een veilige vervangwaarde uit de scène-tekst, zodat het kind gewoon kan
// doorlezen en er alsnog een (iets generiekere) tekening komt. Liever een goed genoeg plaatje
// dan het verhaal laten stilvallen.
function imagePromptOrFallback(imagePrompt: unknown, pages: unknown): string {
  const direct = typeof imagePrompt === "string" ? imagePrompt.trim() : "";
  if (direct) return direct;
  const firstPage = Array.isArray(pages) && typeof pages[0] === "string" ? pages[0].trim() : "";
  const snippet = firstPage.slice(0, 240).replace(/\s+/g, " ");
  return `Een vrolijke, spannende kinderboek-illustratie van deze scène: ${snippet || "de held beleeft een nieuw avontuur."}`;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

// De leestekst komt nu als een array van bladzijden terug (i.p.v. één blok). We schonen die
// op en eisen minstens één niet-lege bladzijde — anders is er niets te lezen en kan de scène
// beter met een duidelijke fout falen dan als leeg hoofdstuk opgeslagen te worden.
function parsePages(value: unknown): string[] {
  const pages = cleanStringArray(value);
  if (pages.length === 0) {
    throw new Error("Het verhaal kon niet goed gemaakt worden. Probeer het nog eens.");
  }
  return pages;
}

// Zet Claude's antwoord om naar een schone lijst nevenpersonages. Bij dubbele namen wint de
// LAATSTE (dat is normaal gesproken de meest bijgewerkte), zodat er nooit twee uiterlijken
// voor hetzelfde personage naast elkaar blijven bestaan.
function cleanSideCharacters(value: unknown): SideCharacter[] {
  if (!Array.isArray(value)) return [];
  const byName = new Map<string, SideCharacter>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const name = "name" in entry && typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name) continue;
    const appearance = cleanSideCharacterAppearance("appearance" in entry ? entry.appearance : undefined);
    if (!appearance.freeform) continue;
    // Claude levert nooit een referenceImageUrl aan — dat is puur van ons. Nieuw geparste
    // personages beginnen dus altijd zonder anker (null); het bestaande anker wordt bij het
    // samenvoegen in nextScene bewaard doordat de bekende registry wint (zie hieronder).
    byName.set(name.toLowerCase(), { name, appearance, referenceImageUrl: null });
  }
  return Array.from(byName.values());
}

// Filtert de volledige registry van bekende nevenpersonages naar alleen degenen die Claude
// aangaf dat écht te zien zijn in déze scène — dat voorkomt dat een personage per ongeluk in
// een illustratie verschijnt waarin het helemaal niet voorkomt.
function resolveSceneCharacters(registry: SideCharacter[], namesInScene: string[]): SideCharacter[] {
  const wanted = new Set(namesInScene.map((n) => n.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return [];
  return registry.filter((c) => wanted.has(c.name.toLowerCase()));
}

// Roept Claude aan met één specifieke tool en dwingt het antwoord daar doorheen —
// zo krijgen we altijd geldige, voorspelbare JSON terug in plaats van losse tekst.
async function callStoryTool<T>(options: {
  tool: Anthropic.Tool;
  userMessage: string;
  maxTokens?: number;
}): Promise<T> {
  const client = getAnthropicClient();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      // Ruim genoeg zodat ook rijkere modellen (bv. Sonnet 5) de volledige JSON —
      // inclusief keuzes, wereld- en personage-beschrijvingen aan het eind — kunnen
      // afmaken zonder afkapping. Extra ruim sinds elke scène nu ~3 leesbladzijden tekst
      // bevat (i.p.v. één kort blok), naast de worldAppearance/sideCharacters die we al
      // meenemen voor beeldconsistentie — anders loopt de JSON tegen de limiet aan.
      max_tokens: options.maxTokens ?? 4608,
      system: SYSTEM_PROMPT,
      tools: [options.tool],
      tool_choice: { type: "tool", name: options.tool.name },
      messages: [{ role: "user", content: options.userMessage }],
    });
  } catch (err) {
    console.error("Anthropic-aanroep mislukt:", err);
    throw new Error(
      "Het verhaal kon niet gegenereerd worden — er ging iets mis bij de AI. Probeer het nog eens.",
    );
  }

  // Als het antwoord tegen de tokenlimiet aanloopt, is de JSON afgekapt en missen bv. de
  // keuzes. Beter een duidelijke fout dan een half verhaal opslaan.
  if (response.stop_reason === "max_tokens") {
    console.error("Anthropic-antwoord afgekapt (max_tokens bereikt).");
    throw new Error("Het verhaal werd te lang om af te maken. Probeer het nog eens.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("Het verhaal kon niet goed gemaakt worden. Probeer het nog eens.");
  }

  return toolUse.input as T;
}

export async function startStory(input: StartStoryInput): Promise<StartStoryResult> {
  const { hero, age, appearance, existingCharacter } = input;

  // Bij hergebruik van een opgeslagen held staat het uiterlijk vast — dan willen we niet dat
  // Claude het opnieuw "vriendelijker herschrijft" (de kans dat details dan verschuiven is
  // precies de reden dat we de bibliotheek hebben). We geven Claude de appearance als harde
  // context mee en vragen het NIET meer om een eigen characterAppearance te verzinnen.
  const appearanceNote = existingCharacter
    ? `Het uiterlijk van de held staat VAST (hergebruik uit de personagens-bibliotheek) en mag NIET veranderd worden — schrijf characterAppearance EXACT over zoals hieronder beschreven:
${describeCharacterAppearance(existingCharacter.appearance)}
Tekenstijl (imageStyleHint) staat ook vast: "${existingCharacter.imageStyleHint}".`
    : `Uiterlijk van de held, zoals het kind dat zelf aangaf (voor later gebruik in illustraties, niet letterlijk in de tekst noemen — schrijf dit eventueel netjes over in characterAppearance): ${appearance}`;

  const userMessage = `Verzin de start van een nieuw verhaal voor een kind van ${age} jaar (leesniveau: ${readingLevelLabel(age)}).

Held: ${hero.name}
Wereld: ${hero.world}
Superkracht: ${hero.power}
Zwakte: ${hero.weakness}
Tegenstander: ${hero.enemy}
Genre: ${hero.genre}
${appearanceNote}

Verzin een verhaalbijbel (5 aktes volgens de heldenreis, toegespitst op deze held, wereld en tegenstander) en een korte titel. Schrijf daarna hoofdstuk 1: de openingsscène als ongeveer 3 leesbladzijden (het veld pages, lengte per bladzijde volgens het leesniveau — zie systeemregel 3), met de cliffhanger op de laatste bladzijde en 3 keuzes voor het kind.`;

  const result = await callStoryTool<StartStoryToolOutput>({
    tool: START_STORY_TOOL,
    userMessage,
  });

  const choices = cleanStringArray(result.choices);
  if (choices.length < 2) {
    throw new Error("Er ging iets mis bij het bedenken van de keuzes. Probeer het nog eens.");
  }

  const chapter: Chapter = {
    n: 1,
    pages: parsePages(result.pages),
    choices,
    chosen: null,
    imagePrompt: imagePromptOrFallback(result.imagePrompt, result.pages),
    imageUrl: null,
  };

  const aktes = cleanStringArray(result.aktes);
  // Hergebruik-route: bestaande appearance + styleHint winnings uit de bibliotheek — Claude's
  // eigen characterAppearance wordt genegeerd (we dwingen het al in de prompt, maar voor de
  // zekerheid overschrijven we het hier ook, anders kan een hallucinatie in de tool-output
  // toch een ander uiterlijk opleveren dan het kind koos).
  const cleanedAppearance: CharacterAppearance = existingCharacter
    ? cleanCharacterAppearance(existingCharacter.appearance, appearance)
    : cleanCharacterAppearance(result.characterAppearance, appearance);
  const styleHint = existingCharacter
    ? existingCharacter.imageStyleHint
    : typeof result.imageStyleHint === "string" && result.imageStyleHint.trim()
      ? result.imageStyleHint.trim()
      : "flat colorful 2D children's picture-book illustration style";
  const worldAppearance = cleanWorldAppearance(result.worldAppearance);
  const sideCharacters = cleanSideCharacters(result.sideCharacters);

  return {
    title: assertNonEmptyString(result.title, "title"),
    bible: {
      aktes: aktes.length ? aktes : [`Het avontuur van ${hero.name} in ${hero.world}.`],
      openThreads: cleanStringArray(result.openThreads),
      worldAppearance,
      worldReferenceImageUrl: null,
      sideCharacters,
    },
    character: {
      appearance: cleanedAppearance,
      imageStyleHint: styleHint,
      items: [],
      portraitUrl: null,
      pendingPortraitUrl: null,
    },
    summary: assertNonEmptyString(result.summary, "summary"),
    chapter,
    sceneCharacters: resolveSceneCharacters(sideCharacters, cleanStringArray(result.charactersInScene)),
  };
}

export async function nextScene(input: NextSceneInput): Promise<NextSceneResult> {
  const { story, choice, age } = input;
  const hero = story.hero;
  const nextN = story.chapters.length + 1;
  const forceFinale = nextN >= HARD_CHAPTER_LIMIT;
  const previousChapter = story.chapters[story.chapters.length - 1];
  // Terugval op lege registry voor oudere verhalen die nog geen bible.sideCharacters hadden.
  const knownSideCharacters = story.bible.sideCharacters ?? [];

  // Oplopende druk om af te ronden: vanaf hoofdstuk 12 rustig uitfaden, vanaf 14 sterk
  // aandringen op de finale. Zo eindigt het verhaal netjes rond ~14 i.p.v. door te denderen.
  let pacingNote = "";
  if (forceFinale) {
    pacingNote =
      "\nDit MOET de allerlaatste scène worden: rond alle open draadjes nu warm af (isFinale = true, lege keuzes-lijst, geen cliffhanger).";
  } else if (nextN >= CHAPTERS_TOTAL) {
    pacingNote = `\nHet verhaal is al lang (hoofdstuk ${nextN}). Maak dit bij voorkeur de finale (isFinale = true), tenzij er echt nog één klein draadje open is — rond dan nu alles af zonder nieuwe problemen te introduceren.`;
  } else if (nextN >= CHAPTERS_TOTAL - 2) {
    pacingNote = `\nWe naderen het einde (rond hoofdstuk ${CHAPTERS_TOTAL}). Introduceer GEEN nieuwe grote problemen meer; werk toe naar de ontknoping en rond open draadjes af.`;
  }

  const userMessage = `Dit wordt hoofdstuk ${nextN}. Richtlijn: dit hoofdstuk hoort ongeveer in akte ${expectedAkte(nextN)} van de verhaalbijbel te zitten, en het verhaal rondt idealiter rond hoofdstuk ${CHAPTERS_TOTAL} netjes af. Leesniveau: ${readingLevelLabel(age)}.

Held: ${hero.name} (kracht: ${hero.power}, zwakte: ${hero.weakness}), tegenstander: ${hero.enemy}, wereld: ${hero.world}.

Vast uiterlijk van ${hero.name} (nooit wijzigen — het imagePrompt van deze scène hoeft dit niet te herhalen, dat voegt de illustratie-code er zelf al aan toe): ${describeCharacterAppearance(story.character.appearance)}

Verhaalbijbel (geheim, nooit letterlijk aan het kind tonen):
${story.bible.aktes.map((akte, i) => `Akte ${i + 1}: ${akte}`).join("\n")}

Open draadjes tot nu toe: ${story.bible.openThreads.length ? story.bible.openThreads.join("; ") : "geen"}

Lopende samenvatting van het verhaal tot nu toe: ${story.summary}

Vaste wereld-beschrijving (nooit wijzigen, alleen gebruiken): ${describeWorldAppearance(story.bible.worldAppearance) || "(nog niet vastgelegd)"}

Bekende nevenpersonages met hun vaste uiterlijk (nooit een bestaand uiterlijk wijzigen, alleen aanvullen met echt nieuwe personages): ${
    knownSideCharacters.length
      ? knownSideCharacters.map((c) => `${c.name}: ${c.appearance.freeform} (kenmerk: ${c.appearance.distinguishingFeature})`).join(" | ")
      : "nog geen"
  }

Vorige scène: ${(previousChapter?.pages ?? []).join("\n\n")}

Het kind koos (dit kan een van de aangeboden opties zijn, of een eigen, zelf getypt idee): "${choice}"
${pacingNote}
Schrijf de volgende scène als ongeveer 3 leesbladzijden (het veld pages, lengte per bladzijde volgens het leesniveau — zie systeemregel 3), met de cliffhanger op de laatste bladzijde. Verwerk de keuze van het kind zichtbaar op de eerste bladzijde. Werk de samenvatting en de open draadjes bij.`;

  const result = await callStoryTool<NextSceneToolOutput>({
    tool: NEXT_SCENE_TOOL,
    userMessage,
  });

  const isFinale = forceFinale || Boolean(result.isFinale);
  const choices = isFinale ? [] : cleanStringArray(result.choices);

  if (!isFinale && choices.length < 2) {
    throw new Error("Er ging iets mis bij het bedenken van de keuzes. Probeer het nog eens.");
  }

  const chapter: Chapter = {
    n: nextN,
    pages: parsePages(result.pages),
    choices,
    chosen: null,
    imagePrompt: imagePromptOrFallback(result.imagePrompt, result.pages),
    imageUrl: null,
  };

  // Claude hoort bestaande personages exact terug te geven. Voor de zekerheid dwingen we dat
  // hier ook in code af: een al bekend uiterlijk wint altijd, ook als Claude het per ongeluk
  // net anders zou verwoorden — anders kan een personage tussen illustraties toch veranderen.
  // Alleen écht nieuwe namen worden toegevoegd.
  const returnedSideCharacters = cleanSideCharacters(result.sideCharacters);
  const mergedByName = new Map<string, SideCharacter>();
  for (const c of returnedSideCharacters) mergedByName.set(c.name.toLowerCase(), c);
  for (const c of knownSideCharacters) mergedByName.set(c.name.toLowerCase(), c); // bekend uiterlijk overschrijft
  const sideCharacters = Array.from(mergedByName.values());

  // Wereld-anker: normaal onveranderd (één vaste wereld door het hele boek). Alleen als
  // Claude een echte locatiewissel meldt ÉN een nieuwe wereld-spec meelevert, werken we
  // worldAppearance bij naar die nieuwe plek — de route maakt er dan een nieuw ankerbeeld
  // bij. Zonder nieuwe spec houden we de bestaande, zodat een losse "true" nooit per
  // ongeluk een leeg/kaal decor oplevert.
  const newLocationAppearance =
    result.newLocation && result.newLocationAppearance
      ? cleanWorldAppearance(result.newLocationAppearance)
      : null;
  const locationReallyChanged = Boolean(newLocationAppearance && newLocationAppearance.freeform);
  const updatedBible: StoryBible = {
    aktes: story.bible.aktes,
    openThreads: isFinale ? [] : cleanStringArray(result.openThreads),
    worldAppearance: locationReallyChanged ? newLocationAppearance! : story.bible.worldAppearance,
    // Bij een echte locatiewissel wordt het oude ankerbeeld ongeldig: op null zetten dwingt
    // de route om een vers wereld-referentiebeeld te maken voor de nieuwe plek.
    worldReferenceImageUrl: locationReallyChanged ? null : (story.bible.worldReferenceImageUrl ?? null),
    sideCharacters,
  };

  return {
    chapter,
    summary: assertNonEmptyString(result.summary, "summary").slice(0, 600),
    bible: updatedBible,
    isFinale,
    sceneCharacters: resolveSceneCharacters(sideCharacters, cleanStringArray(result.charactersInScene)),
    // Bij de finale doet deze vlag er niet meer toe (shouldGenerateFreshImage forceert daar
    // toch al altijd een verse illustratie), maar we nemen Claude's eigen antwoord over.
    visuallyDistinctFromPrevious: Boolean(result.visuallyDistinctFromPrevious),
    newLocation: locationReallyChanged,
  };
}
