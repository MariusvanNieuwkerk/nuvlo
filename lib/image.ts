// Beeld-AI. Server-side module die illustraties en held-portretten genereert via fal.ai
// (Nano Banana 2 / Gemini 3.1 Flash Image). Nooit in een "use client" bestand importeren —
// de FAL_KEY mag nooit naar de browser.
//
// We slaan alleen de URL op die fal.ai teruggeeft (gehost op hun eigen CDN). Er wordt
// niets naar de lokale schijf geschreven, dus dit blijft ook werken op een server met een
// wisselend bestandssysteem.
//
// TWEE ARCHITECTUURKEUZES die eerdere, herhaalde klachten structureel voorkomen (in plaats
// van steeds opnieuw een los symptoom te patchen):
//
// 1) GESTRUCTUREERDE INVOER (zie lib/appearance.ts) — geen vrije zin meer, maar losse
//    velden per visueel kenmerk (haar, kleding, élk accessoire apart, het ene meest
//    kenmerkende detail). Zo kan describeCharacterAppearance()/describeWorldAppearance()
//    hieronder ALLE kenmerken apart en verplicht opsommen in de prompt — niets kan meer
//    stilletjes verdwijnen in één lange zin.
//
// 2) GENEREREN + VERIFIËREN (zie lib/ai/vision-verify.ts) — elke generatie is niet langer
//    fire-and-forget. Na het genereren checken we met een snel vision-model of de
//    harde-eisen-checklist (accessoires, het kenmerkende detail) écht op de afbeelding
//    staat. Zo niet, dan proberen we het tot 2x opnieuw met een aangescherpte prompt die
//    precies benoemt wat er de vorige keer ontbrak. Dit is de feedback-loop die er eerst
//    niet was — zonder deze loop bleef elke modelwissel een gok, en kwam een regressie
//    alleen via een klacht weken later aan het licht.
//
// BEELDCONSISTENTIE — referentiebeelden (KOSTEN-AFWEGING):
// Puur tekst-naar-plaatje (elke illustratie los) is niet betrouwbaar genoeg: hetzelfde
// personage ziet er per plaat toch anders uit. Daarom gaan er ankerBEELDEN mee naar het
// edit-endpoint. Wat er op het runtime-pad (lezen/kiezen) precies gebeurt:
// - HELD: character.portraitUrl gaat altijd mee als referentie. Dat beeld is een vierkant
//   buste-portret (hoofd + schouders + borst) — groot genoeg voor de ronde avatars, en met
//   kleding/accessoires nog zichtbaar voor latere scènes. Zie generatePortrait.
// - NEVENPERSONAGES: elk personage dat in déze scène te zien is krijgt eenmalig een eigen
//   ankerbeeld (zie lib/side-character-images.ts, quota-beschermd) dat daarna gratis in elke
//   volgende scène hergebruikt wordt.
// - WERELD: GEEN ankerbeeld op het runtime-pad (de route geeft hier null door) — de omgeving
//   gaat alleen als TEKST mee. generateWorldReferenceImage bestaat nog wel, maar wordt
//   uitsluitend offline gebruikt (scripts/check-image-consistency.ts). Dit is de plek om te
//   kijken als omgevingen tussen hoofdstukken blijven schuiven.
//
// Model-keuze: we gebruikten eerst fal-ai/flux-pro/kontext voor de beeld-naar-beeld stap.
// Kontext is een lokaal PIXEL-EDIT-model — gemaakt voor kleine, gerichte aanpassingen in
// een bestaand beeld, en het verzet zich sterk tegen een compleet nieuwe compositie. Met
// een close-up portret als referentie bleef Kontext daardoor telkens diezelfde close-up
// teruggeven, met alleen een net iets andere achtergrond — de scène-tekst werd genegeerd.
// Nano Banana 2 (fal-ai/nano-banana-2 / .../edit) is wél een echte scène-COMPOSER, expliciet
// gepositioneerd voor "storyboarding met een consistent personage over meerdere platen" —
// precies dit gebruiksgeval — én volgt tekstinstructies veel nauwkeuriger op.
import "server-only";
import { fal } from "@fal-ai/client";
import {
  describeCharacterAppearance,
  describeWorldAppearance,
  lockedIdentityRule,
  type CharacterAppearance,
  type WorldAppearance,
} from "@/lib/appearance";
import { verifyImageAttributes } from "@/lib/ai/vision-verify";
import type { SideCharacter } from "@/lib/types";

// MODEL OMSCHAKELBAAR VIA ENV — kosten/snelheid instelbaar zonder code te wijzigen.
// De DEFAULT blijft bewust nano-banana-2 (mooiste resultaat, echte scène-composer). Wil de
// gebruiker goedkoper/sneller, dan zet die IMAGE_MODEL bv. op "fal-ai/flux/schnell".
// Mogelijke waarden (voorbeelden): "fal-ai/nano-banana-2" (default) of "fal-ai/flux/schnell".
const IMAGE_MODEL_DEFAULT = "fal-ai/nano-banana-2";
// Tekst-naar-plaatje: voor het allereerste referentiebeeld (portret) of als terugval wanneer
// er geen edit-model is.
const T2I_MODEL = process.env.IMAGE_MODEL?.trim() || IMAGE_MODEL_DEFAULT;
// Beeld-naar-beeld (referentie-gebaseerd): houdt de held uit het portret herkenbaar vast,
// terwijl de scène vrij verandert. Los instelbaar via IMAGE_EDIT_MODEL, want niet elk model
// heeft een edit-variant. Leeg laten (IMAGE_EDIT_MODEL="") schakelt de referentie-consistentie
// uit → dan valt requestImageFromReference netjes terug op tekst-naar-plaatje. Default: de
// edit-variant van nano-banana-2, maar alléén als IMAGE_MODEL óók nano-banana is (anders weten
// we niet of er een edit-endpoint bestaat en is tekst-naar-plaatje de veilige terugval).
const EDIT_MODEL =
  process.env.IMAGE_EDIT_MODEL !== undefined
    ? process.env.IMAGE_EDIT_MODEL.trim()
    : T2I_MODEL === IMAGE_MODEL_DEFAULT
      ? "fal-ai/nano-banana-2/edit"
      : "";

// Nano Banana 2 accepteert de gewenste beeldverhouding direct als ratio-string.
type FalAspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

// Vaste resolutie: "1K" is voor een kinderboek-illustratie ruim scherp genoeg, en
// merkbaar sneller/goedkoper dan "2K"/"4K" — relevant omdat elk kind een dagelijkse
// limiet aan illustraties heeft (MAX_IMAGES_PER_DAY_PER_CHILD).
const RESOLUTION = "1K";

// Verschillende fal-modellen verwachten verschillende invoervelden voor het formaat: de
// nano-banana-familie neemt aspect_ratio + resolution, terwijl flux-achtige modellen alleen
// image_size kennen. Deze helper vertaalt de gewenste ratio naar de juiste velden, zodat een
// modelwissel (IMAGE_MODEL) niet meteen op een "onbekend veld"-fout stuit.
const IMAGE_SIZE_BY_RATIO: Record<FalAspectRatio, string> = {
  "1:1": "square_hd",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};

function isNanoBananaModel(model: string): boolean {
  return model.includes("nano-banana");
}

// De "lite"-varianten (google/nano-banana-lite, google/nano-banana-2-lite en hun /edit-
// endpoints) hebben GEEN resolution-veld in hun schema — fal.ai wijst het request af als we
// dat toch meesturen. Alleen de volle nano-banana-modellen (fal-ai/nano-banana-2,
// fal-ai/nano-banana-pro) ondersteunen resolution.
function isLiteModel(model: string): boolean {
  return model.includes("nano-banana") && model.includes("lite");
}

function buildFormatInput(model: string, aspectRatio: FalAspectRatio): Record<string, unknown> {
  if (isNanoBananaModel(model)) {
    return isLiteModel(model)
      ? { aspect_ratio: aspectRatio, num_images: 1 }
      : { aspect_ratio: aspectRatio, resolution: RESOLUTION, num_images: 1 };
  }
  return { image_size: IMAGE_SIZE_BY_RATIO[aspectRatio], num_images: 1 };
}

// Maximaal aantal HERgeneraties na een mislukte verificatie (dus max. 2 pogingen in totaal).
// Bewust laag gehouden: dit zit op het kritieke pad van de achtergrond-illustratie (fase B),
// en elke extra poging is een volledige fal.ai-generatie + vision-check erbij — dat tikt snel
// aan tot minuten. Eén herkansing vangt een eenmalige misser op; snelheid gaat nu voor een
// laatste procentje trefzekerheid (het verhaal wordt hier sowieso nooit door geblokkeerd).
const MAX_VERIFICATION_RETRIES = 1;

// Beeldmodellen volgen een expliciete, Engelse kunststijl-term veel sterker dan een
// Nederlandse omschrijving als "blokkerig" — die wordt anders al snel platgewalst tot een
// generiek rond tekenfilm-kindje. Daarom laat story-director.ts de AI per verhaal een
// eigen Engelse stijl-hint verzinnen (character.imageStyleHint), die we hier vooraan én
// achteraan in de prompt herhalen.
const NO_PHOTO_RULE = "Colorful digital illustration for a children's book — NOT a photo, NOT a realistic photo of a real person.";

function buildStyleBlock(styleHint: string | undefined): { prefix: string; suffix: string } {
  const hint = styleHint?.trim() || "flat colorful 2D children's picture-book illustration style";
  return {
    prefix: `${NO_PHOTO_RULE} MANDATORY art style for the ENTIRE image (characters and background): ${hint}. Do not use any other illustration style.`,
    suffix: `FINAL CHECK: the whole image is only in this art style: ${hint}. Cheerful, warm mood. IMPORTANT: absolutely no text, letters, titles, logos, or writing anywhere in the image, not even small or in the background.`,
  };
}

// Logt zo veel mogelijk nuttige details van een mislukte fal.ai-aanroep (model-ID, status,
// response-body) — zonder dit was een verkeerd/niet-bestaand model-ID (bv. een typo in
// IMAGE_MODEL) alleen te zien als "er komt geen plaatje", met geen enkel spoor WAAROM in de
// logs. We blijven het verhaal nooit blokkeren op deze fout; dit is puur voor debuggen.
function logFalError(context: string, model: string, err: unknown): void {
  const details =
    err && typeof err === "object" && "body" in err
      ? JSON.stringify((err as { body?: unknown }).body)
      : err instanceof Error
        ? err.message
        : String(err);
  console.error(`fal.ai-aanroep mislukt (${context}, model="${model}"):`, details);
}

let configured = false;

function ensureConfigured(): boolean {
  const key = process.env.FAL_KEY?.trim();
  if (!key) return false;
  if (!configured) {
    fal.config({ credentials: key });
    configured = true;
  }
  return true;
}

// Resultaat van een generatiepoging: naast de URL geven we ook mee of de harde-eisen-
// checklist daadwerkelijk bevestigd is. `verified` is puur informatief/debugbaar (zie
// CharacterSheet.portraitVerificationFailed / Chapter.imageVerificationFailed) — we
// blokkeren een verhaal NOOIT op een mislukte verificatie, de beste poging wordt gebruikt.
export type ImageResult = { url: string | null; verified: boolean };

async function requestImage(
  prompt: string,
  styleHint: string | undefined,
  aspectRatio: FalAspectRatio = "4:3",
): Promise<string | null> {
  if (!ensureConfigured()) {
    console.warn("FAL_KEY ontbreekt — illustratie wordt overgeslagen.");
    return null;
  }

  const { prefix, suffix } = buildStyleBlock(styleHint);

  try {
    const result = await fal.subscribe(T2I_MODEL, {
      input: {
        prompt: `${prefix} ${prompt} ${suffix}`,
        ...buildFormatInput(T2I_MODEL, aspectRatio),
      },
    });
    const url = (result.data as { images?: { url: string }[] })?.images?.[0]?.url;
    return url ?? null;
  } catch (err) {
    logFalError("tekst-naar-plaatje", T2I_MODEL, err);
    return null;
  }
}

// referenceImageUrls kan zowel het held-portret als het wereld-referentiebeeld bevatten
// (of beide) — Nano Banana 2's edit-endpoint ondersteunt meerdere referentiebeelden
// tegelijk, precies om zowel personage- als omgevingsidentiteit te verankeren.
async function requestImageFromReference(
  prompt: string,
  referenceImageUrls: string[],
  styleHint: string | undefined,
  aspectRatio: FalAspectRatio = "4:3",
  referenceLegend?: string,
): Promise<string | null> {
  if (!ensureConfigured()) {
    console.warn("FAL_KEY ontbreekt — illustratie wordt overgeslagen.");
    return null;
  }

  // Geen edit-model beschikbaar (bv. na een modelwissel naar een model zonder edit-endpoint):
  // val terug op tekst-naar-plaatje. De personage-consistentie via het referentiebeeld gaat
  // dan verloren, maar het verhaal blijft gewoon van illustraties voorzien.
  if (!EDIT_MODEL) {
    return requestImage(prompt, styleHint, aspectRatio);
  }

  const { prefix, suffix } = buildStyleBlock(styleHint);

  try {
    const result = await fal.subscribe(EDIT_MODEL, {
      input: {
        prompt: `${prefix} ${referenceLegend ? `${referenceLegend} ` : ""}Each numbered reference is ONE locked identity. Copy WHO that character is (face, hair, body shape, clothes, colors). Do NOT copy the art style, shading, or medium of the reference images — redraw everything in the mandatory art style. Do not invent a second version of the same character. Do not recolor clothes. Then draw a completely NEW full scene: do NOT copy reference composition, camera or background, and do not return a face close-up if the scene describes something else. Pose and place may change; identity never changes. ${prompt} ${suffix}`,
        image_urls: referenceImageUrls,
        ...buildFormatInput(EDIT_MODEL, aspectRatio),
      },
    });
    const url = (result.data as { images?: { url: string }[] })?.images?.[0]?.url;
    return url ?? null;
  } catch (err) {
    logFalError("referentiebeeld", EDIT_MODEL, err);
    return null;
  }
}

// De generatie-en-verificatie-loop: een echte feedback-loop die na het genereren met een
// vision-model checkt of de harde-eisen-checklist écht op de afbeelding staat, en zo niet
// opnieuw probeert. BELANGRIJK (kosten/snelheid): deze loop zit NIET meer op het runtime-pad
// (choice/fase B/nieuw verhaal) — die genereren nu bewust één keer zonder verificatie, want
// elke verify + hergeneratie is een extra (dure, trage) call. De loop blijft alléén over voor
// de wereld-/nevenpersonage-ankerbeelden, die nog uitsluitend offline gebruikt worden
// (scripts/check-image-consistency.ts), niet tijdens het lezen/kiezen.
async function generateWithVerification(
  requiredAttributes: string[],
  subjectLabel: string,
  attempt: (missingFromLastTry: string[]) => Promise<string | null>,
): Promise<ImageResult> {
  let lastUrl: string | null = null;
  let missing: string[] = [];

  for (let tryN = 0; tryN <= MAX_VERIFICATION_RETRIES; tryN++) {
    const url = await attempt(missing);
    if (!url) return { url: lastUrl, verified: false };
    lastUrl = url;

    if (requiredAttributes.length === 0) return { url, verified: true };

    const check = await verifyImageAttributes(url, requiredAttributes, subjectLabel);
    if (check.attributesPresent) return { url, verified: true };

    missing = check.missing.length ? check.missing : requiredAttributes;
    console.warn(
      `Beeldverificatie: kenmerken ontbraken bij "${subjectLabel}" (poging ${tryN + 1}/${MAX_VERIFICATION_RETRIES + 1}): ${missing.join(", ")}`,
    );
  }

  console.warn(
    `Beeldverificatie: na ${MAX_VERIFICATION_RETRIES + 1} pogingen nog steeds ontbrekende kenmerken bij "${subjectLabel}" — beste poging wordt toch gebruikt (verhaal wordt hier nooit door geblokkeerd).`,
  );
  return { url: lastUrl, verified: false };
}

function reinforcementNote(missing: string[]): string {
  if (!missing.length) return "";
  return ` BELANGRIJK, dit werd bij de vorige poging NIET goed getekend: ${missing.join(", ")}. Zorg dat dit nu overduidelijk en onmiskenbaar zichtbaar is.`;
}

// Combineert de scène-prompt met het gestructureerde uiterlijk van de held, de vaste
// wereld-spec en het uiterlijk van eventuele nevenpersonages die in déze scène voorkomen —
// zodat personages én omgeving er door het hele boek heen hetzelfde uitzien, in plaats van
// dat elke illustratie los opnieuw "verzint" hoe iets eruitziet.
//
// referencePortraitUrl/worldReferenceImageUrl: de vaste ankerbeelden. Beide beschikbaar?
// Dan gaan beide mee als referentie (personage + omgeving verankerd). Is er nog geen enkel
// ankerbeeld (zou niet meer moeten voorkomen sinds we het portret altijd eerst maken), dan
// valt dit terug op tekst-naar-plaatje.
export async function generateSceneImage(
  imagePrompt: string,
  appearance: CharacterAppearance,
  styleHint: string | undefined,
  world?: WorldAppearance,
  sceneCharacters?: SideCharacter[],
  referencePortraitUrl?: string | null,
  worldReferenceImageUrl?: string | null,
  // Alleen gevuld als de held er in DEZE scène tijdelijk anders uitziet dan normaal (zie
  // Chapter.heroTemporaryAppearance in lib/types.ts). ZONDER deze parameter kreeg elke
  // illustratie onvoorwaardelijk de instructie "teken het vaste, normale uiterlijk" — ook
  // als de scènetekst een transformatie beschreef. Het model probeerde dan BEIDE
  // instructies te volgen en tekende de held soms twee keer: één keer normaal, én nog eens
  // in de nieuwe vorm, als los personage ernaast. Is dit veld gevuld, dan vervangt het de
  // vaste-uiterlijk-instructie volledig (in plaats van hem aan te vullen) en laten we ook
  // het held-portret als referentiebeeld weg — dat portret toont namelijk de NORMALE vorm,
  // en zou het model juist terugtrekken richting die normale vorm.
  heroTemporaryAppearance?: string | null,
  // Vorige scène-plaat: extra identiteitsanker (volle figuur, dus ook broek/schoenen),
  // zodat kledingkleuren niet per hoofdstuk opnieuw verzonnen worden.
  previousSceneImageUrl?: string | null,
  heroName?: string,
): Promise<ImageResult> {
  // De vaste identiteits-/wereldbeschrijving komt vóóraan en altijd in dezelfde woorden —
  // beeldmodellen hechten meer gewicht aan wat vroeg in de prompt staat, en een letterlijk
  // herhaald "personage-sheet" werkt als een steviger anker dan wanneer het steeds ergens
  // anders (en soms in andere woorden) in de prompt opduikt.
  const namedSides = (sceneCharacters ?? []).filter((c) => c.name.trim());
  const sideCharacterLines = namedSides
    .filter((c) => c.appearance.freeform.trim())
    .map((c) => `VAST uiterlijk van ${c.name} (één wezen, nooit een tweede versie, nooit herkleuren): ${c.appearance.freeform}${c.appearance.distinguishingFeature ? ` (kenmerk dat nooit mag ontbreken: ${c.appearance.distinguishingFeature})` : ""}`)
    .join(" ");
  const heroLabel = heroName?.trim() || "de held";
  const heroLine = heroTemporaryAppearance
    ? `BELANGRIJK, tijdelijke vorm: in DEZE ene illustratie ziet ${heroLabel} er NIET normaal uit, maar zo: ${heroTemporaryAppearance}. Dit is nog STEEDS hetzelfde personage — er is maar ÉÉN wezen in deze illustratie. Teken NOOIT ook de normale/originele vorm van het personage erbij als los, tweede figuur ernaast; laat die normale vorm hier volledig weg.`
    : `De hoofdpersoon ${heroLabel} ziet er zo uit: ${describeCharacterAppearance(appearance)}. ${lockedIdentityRule()}`;
  const namedCast = [heroLabel, ...namedSides.map((c) => c.name)].join(", ");
  const oneEachRule = `Teken elk personage precies één keer. Geen tweede robot, geen dubbele held. Alleen deze figuren: ${namedCast}.`;
  const fixedFacts = [
    heroLine,
    sideCharacterLines,
    oneEachRule,
    world ? `De wereld/omgeving ziet er zo uit: ${describeWorldAppearance(world)}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  // Referenties in vaste volgorde, met een nummer in de prompt. Zonder die koppeling
  // mengt het model twee robots of herontwerpt het dezelfde figuur.
  const labeledRefs: { url: string; label: string }[] = [];
  if (!heroTemporaryAppearance && referencePortraitUrl) {
    labeledRefs.push({
      url: referencePortraitUrl,
      label: `${heroLabel} (held) — kopieer gezicht, haar, kleding en kleuren exact`,
    });
  }
  for (const character of namedSides) {
    if (!character.referenceImageUrl) continue;
    labeledRefs.push({
      url: character.referenceImageUrl,
      label: `${character.name} — kopieer dit wezen exact, teken geen andere versie`,
    });
  }
  if (worldReferenceImageUrl) {
    labeledRefs.push({
      url: worldReferenceImageUrl,
      label: "de wereld/omgeving",
    });
  }
  if (!heroTemporaryAppearance && previousSceneImageUrl) {
    const hasCharacterRefs = labeledRefs.some((item) => item.label.includes("kopieer"));
    labeledRefs.push({
      url: previousSceneImageUrl,
      label: hasCharacterRefs
        ? "de vorige scène — alleen sfeer en plek; personage-uiterlijk komt UIT de personage-referenties hierboven, niet uit dit plaatje"
        : "vorige scène — zelfde personages, nieuwe houding en plek, niemand herontwerpen",
    });
  }

  const referenceUrls = labeledRefs.map((item) => item.url);
  const referenceLegend = labeledRefs
    .map((item, i) => `Reference image ${i + 1} is ${item.label}.`)
    .join(" ");

  // BEWUST één generatie zonder vision-verificatie: dit zit op het kritieke leespad en elke
  // verify + hergeneratie is een extra dure/trage call. De beste poging wordt gebruikt.
  const prompt = `${fixedFacts}. BELANGRIJK: dit is GEEN portret-opdracht — teken een volledige, brede scène die het onderstaande écht laat zien (de omgeving, andere personages, actie, sfeer), geen close-up van alleen het gezicht. De scène mag houding en plek veranderen, niet het uiterlijk. Scène (alleen actie en plek, geen nieuwe kleding, geen extra personages): ${imagePrompt}.`;

  const url =
    referenceUrls.length > 0
      ? await requestImageFromReference(prompt, referenceUrls, styleHint, "4:3", referenceLegend)
      : await requestImage(prompt, styleHint, "4:3");
  return { url, verified: true };
}

// Het held-beeld: tegelijk het ronde avatartje (home, boekenplank) én het ANKERBEELD dat bij
// elke scène-illustratie als referentie meegaat.
//
// Dit is een vierkant BUSTE-portret (hoofd + schouders + borst), geen wijde scène en geen
// gezicht-alleen-close-up. Een scène als anker maakte de cirkels onleesbaar (held te klein).
// Een gezicht-close-up liet kleding per hoofdstuk opnieuw verzinnen. De buste houdt het
// gezicht groot in de cirkel én laat outfit/accessoires nog zien voor latere scènes.
//
// BELANGRIJK: we gebruiken hier NIET requestImageFromReference. Die helper dwingt een
// "volledige nieuwe scène" af — precies wat een portret niet mag worden. Had de held al
// een beeld, dan gaat dat wél mee als identiteits-referentie, maar met een eigen prompt
// die compositie/landschap van het oude beeld bewust weggooit.
//
// "moment" beschrijft kort waar het verhaal nu staat. previousPortraitUrl: had de held al
// een beeld, dan blijft het hetzelfde personage — anders tekenen we vanaf nul.
export async function generatePortrait(
  appearance: CharacterAppearance,
  moment: string,
  styleHint: string | undefined,
  previousPortraitUrl?: string | null,
): Promise<ImageResult> {
  const prompt = `Square avatar portrait of a children's-book hero. ONE character only. Tight bust shot from the chest up: head, face, shoulders and chest fill at least 75% of the frame. The face is large, centered, looking toward the viewer, clearly readable in a small circle. Soft plain background (one color or gentle gradient). NO landscape, NO mountains, NO sky vista, NO wide scene, NO other characters, NO full-body shot, NO tiny figure standing in a world. Appearance (follow literally; outfit colors on the chest/shoulders must be clearly visible — this portrait is the identity lock for later scenes): ${describeCharacterAppearance(appearance)}. ${lockedIdentityRule()} Story moment: ${moment}.`;

  const url = await requestPortraitImage(prompt, styleHint, previousPortraitUrl);
  return { url, verified: true };
}

// Portret-generatie los van requestImageFromReference, omdat die helper altijd "teken een
// complete nieuwe scène" meegeeft — daardoor werden eerdere portret-refreshs landschappen.
async function requestPortraitImage(
  prompt: string,
  styleHint: string | undefined,
  previousPortraitUrl?: string | null,
): Promise<string | null> {
  if (!ensureConfigured()) {
    console.warn("FAL_KEY ontbreekt — illustratie wordt overgeslagen.");
    return null;
  }

  const { prefix, suffix } = buildStyleBlock(styleHint);
  const aspectRatio: FalAspectRatio = "1:1";

  if (previousPortraitUrl && EDIT_MODEL) {
    try {
      const result = await fal.subscribe(EDIT_MODEL, {
        input: {
          prompt: `${prefix} The reference image is ONLY for this character's identity (face, hair, clothes, colors). Draw a NEW tight square bust portrait of that SAME character, fully redrawn in the mandatory art style. Do NOT copy the art style of the reference. Head, face, shoulders and chest fill the frame. Face large and centered. Soft plain background. Do NOT copy the reference composition, landscape, camera, or scenery. No wide scene, no tiny figure in a landscape, no full-body shot. ${prompt} ${suffix}`,
          image_urls: [previousPortraitUrl],
          ...buildFormatInput(EDIT_MODEL, aspectRatio),
        },
      });
      const url = (result.data as { images?: { url: string }[] })?.images?.[0]?.url;
      if (url) return url;
    } catch (err) {
      logFalError("portret-referentie", EDIT_MODEL, err);
    }
  }

  return requestImage(prompt, styleHint, aspectRatio);
}

// Eén vast referentiebeeld van de wereld zelf, los van elk personage — het tweede
// beeld-anker (zie architectuurnotitie hierboven). Wordt normaal gesproken precies één
// keer gemaakt, meteen bij het allereerste hoofdstuk, en blijft daarna ongewijzigd.
export async function generateWorldReferenceImage(
  world: WorldAppearance,
  styleHint: string | undefined,
): Promise<ImageResult> {
  const requiredAttributes = world.landmark ? [world.landmark] : [];

  return generateWithVerification(requiredAttributes, "een referentiebeeld van de wereld/omgeving", async (missing) => {
    const prompt = `Sfeervolle, brede omgevingsillustratie zonder personages: laat de wereld zelf zien, met genoeg ruimte en diepte om als vast decor-referentiebeeld te dienen voor latere scènes. Wereld: ${describeWorldAppearance(world)}.${reinforcementNote(missing)}`;
    return requestImage(prompt, styleHint, "16:9");
  });
}

// Eén vast referentiebeeld van ÉÉN nevenpersonage, los van elke scène — het derde
// beeld-anker, in dezelfde geest als het held-portret en het wereld-referentiebeeld.
// WAAROM dit nodig was: nevenpersonages hadden tot nu toe alléén een tekstbeschrijving, en
// dat bleek — net als eerder bij de held — te verliesgevoelig: dezelfde "boogieman" werd de
// ene plaat een reuzensilhouet, de andere een klein wolkje. Een schoon, herkenbaar ankerbeeld
// dwingt de vorm/kleur/het kenmerk wél af over alle latere platen heen.
//
// previousReferenceUrl: had dit personage al een anker (het evolueert mee), dan gebruiken we
// dat als referentie zodat het duidelijk hetzelfde wezen blijft. De allereerste keer is het
// pure tekst-naar-plaatje. Het distinguishingFeature gaat als harde eis door de verificatie-
// loop, zodat de verify-en-retry precies dat kenmerk afdwingt.
export async function generateSideCharacterReferenceImage(
  character: SideCharacter,
  styleHint: string | undefined,
  previousReferenceUrl?: string | null,
): Promise<ImageResult> {
  const feature = character.appearance.distinguishingFeature.trim();
  // Bewust GEEN vision-verificatie op nevenpersonage-ankers (lege lijst → geen verify-loop, geen
  // retries). Een anker hoeft maar globaal te kloppen; de dure verificatie bewaren we voor de
  // scène-illustratie zelf (daar telt consistentie het meest). Dit scheelt fase B per
  // nieuw nevenpersonage een vision-call plus mogelijke hergeneraties. Het kenmerk gaat nog wél
  // nadrukkelijk in de prompt mee, zodat het anker het zoveel mogelijk toont.
  const requiredAttributes: string[] = [];
  const featureLine = feature ? ` Het kenmerk dat NOOIT mag ontbreken en duidelijk zichtbaar moet zijn: ${feature}.` : "";

  return generateWithVerification(requiredAttributes, `referentiebeeld van nevenpersonage ${character.name}`, async (missing) => {
    const prompt = `Schoon referentiebeeld van ÉÉN enkel figuur, het hele wezen goed in beeld (geen close-up van alleen een detail), vriendelijke uitstraling, op een neutrale, egale achtergrond zonder verdere scène of andere personages. Dit is ${character.name} en niemand anders. VAST uiterlijk (volg LETTERLIJK, zelfde kleuren en vorm, nooit herontwerpen): ${character.appearance.freeform}.${featureLine} Dit is de enige versie van ${character.name}.${reinforcementNote(missing)}`;

    if (previousReferenceUrl) {
      const legend = `Reference image 1 is ${character.name} — haal ALLEEN dit wezen eruit, kopieer vorm en kleuren exact, negeer alle andere figuren.`;
      return requestImageFromReference(prompt, [previousReferenceUrl], styleHint, "3:4", legend);
    }
    return requestImage(prompt, styleHint, "3:4");
  });
}

// Eén sfeervolle "boekomslag" voor het hele verhaal, gebruikt op de boekenplank op Home
// in plaats van de vaste genre-kleur. Portret-formaat, zoals een echte boekenkaft: de
// held groot in beeld, met net genoeg van de wereld erbij voor sfeer.
//
// referencePortraitUrl/worldReferenceImageUrl: de ankerbeelden die we al hebben — als
// referentie, zodat de cover, het portret en de scènes allemaal dezelfde held én wereld
// tonen.
export async function generateCoverImage(
  world: string,
  appearance: CharacterAppearance,
  styleHint: string | undefined,
  worldAppearance?: WorldAppearance,
  referencePortraitUrl?: string | null,
  worldReferenceImageUrl?: string | null,
): Promise<ImageResult> {
  // Bewust GEEN titel/naam in de prompt: het woord "boekomslag" of een titel erbij
  // verleidt het model ertoe om (onleesbare) tekst in de afbeelding te tekenen.
  const worldLine = worldAppearance ? ` De wereld ziet er precies zo uit: ${describeWorldAppearance(worldAppearance)}.` : "";
  const referenceUrls = [referencePortraitUrl, worldReferenceImageUrl].filter(
    (u): u is string => Boolean(u),
  );

  // Eén generatie zonder vision-verificatie (zie generateSceneImage).
  const prompt = `Sfeervolle illustratie: de held staat groot, trots en vol zelfvertrouwen in beeld, met de wereld "${world}" mooi uitgewerkt op de achtergrond.${worldLine} Uiterlijk van de held (volg dit LETTERLIJK, elk kledingstuk/accessoire moet zichtbaar zijn): ${describeCharacterAppearance(appearance)}. Uitnodigend en avontuurlijk. Absoluut GEEN tekst, GEEN letters, GEEN titel, GEEN logo — nergens in de afbeelding, ook niet klein of op de achtergrond.`;

  const url =
    referenceUrls.length > 0
      ? await requestImageFromReference(prompt, referenceUrls, styleHint, "3:4")
      : await requestImage(prompt, styleHint, "3:4");
  return { url, verified: true };
}
