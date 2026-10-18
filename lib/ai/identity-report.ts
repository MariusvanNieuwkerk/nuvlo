// Schaduwmeting: is de nieuwe scène nog herkenbaar hetzelfde figuur als het paspoort?
//
// Dit bestand tekent niets en beslist niets over een herkansing. Stap D (opnieuw
// tekenen op basis van deze score) staat uit. De bestaande kenmerk-check in
// lib/ai/vision-verify.ts (verifyImageAttributes) blijft de enige check die een
// herkansing mag starten.

export const IDENTITY_CHECK_TRIGGERS_RETRY = false;

export type IdentityVerdict = "passed" | "failed" | "unknown";

export type CharacterIdentityScore = {
  slot: string;
  verdict: IdentityVerdict;
  sameCharacter: boolean | null;
  face: boolean | null;
  hair: boolean | null;
  body: boolean | null;
  clothes: boolean | null;
  style: boolean | null;
  note: string;
  // Wat de controle zegt dat er op de NIEUWE tekening staat, en op het paspoort.
  sceneLook: string;
  passportLook: string;
};

export type SceneIdentityReport = {
  status: IdentityVerdict;
  actionShown: boolean | null;
  styleMatches: boolean | null;
  characters: CharacterIdentityScore[];
  model: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  influencesRetry: false;
  // Beschrijving van alleen de nieuwe tekening, gemaakt zonder het paspoort erbij.
  sceneDescription?: string;
  error?: string;
};

export type IdentitySlot = {
  slot: string;
  passportUrl: string | null;
  // Waarom dit figuur niet visueel vergeleken wordt. Leeg als er een paspoort is.
  skipReason?: string;
};

const VERDICTS: readonly IdentityVerdict[] = ["passed", "failed", "unknown"];

export function buildSceneIdentitySlots(input: {
  heroPassportUrl: string | null;
  compareHero: boolean;
  sidePassportUrls: (string | null)[];
}): IdentitySlot[] {
  const slots: IdentitySlot[] = [];
  if (!input.compareHero) {
    slots.push({
      slot: "held",
      passportUrl: null,
      skipReason: "tijdelijke vorm, paspoort niet vergeleken",
    });
  } else if (!input.heroPassportUrl) {
    slots.push({ slot: "held", passportUrl: null, skipReason: "geen paspoort" });
  } else {
    slots.push({ slot: "held", passportUrl: input.heroPassportUrl });
  }

  input.sidePassportUrls.forEach((url, index) => {
    const slot = `bijfiguur-${index + 1}`;
    if (!url) {
      slots.push({ slot, passportUrl: null, skipReason: "geen paspoort" });
    } else {
      slots.push({ slot, passportUrl: url });
    }
  });
  return slots;
}

export function buildIdentityPrompt(input: {
  action: string;
  slots: string[];
  styleHint?: string;
  sceneDescription: string;
  passportDescriptions: { slot: string; text: string }[];
}): string {
  const list = input.slots.map((slot) => `- ${slot}`).join("\n");
  const passports = input.passportDescriptions
    .map((item) => `Paspoort ${item.slot} (alleen dat plaatje): ${item.text || "(geen beschrijving)"}`)
    .join("\n");
  const styleLine = input.styleHint?.trim()
    ? `De bedoelde tekenstijl is: ${input.styleHint.trim()}.`
    : "De bedoelde tekenstijl is de stijl van de paspoorten.";
  const actionLine = input.action.trim() || "(geen actie opgegeven)";

  return `Je vergelijkt geschreven beschrijvingen. Je ziet de platen niet opnieuw.
De beschrijving van de NIEUWE tekening is gemaakt zonder paspoort.
De paspoortbeschrijving is gemaakt zonder de nieuwe tekening.
sceneLook moet uit de nieuwe tekening komen. Neem de paspoortfiguur niet over alsof die op de nieuwe tekening staat.
Als de nieuwe tekening een ander kind, ander haar, een andere soort of duidelijk andere kleding toont: failed.

Nieuwe tekening: ${input.sceneDescription || "(geen beschrijving)"}

${passports}

Beoordeel ELK personage apart, alleen tegen zijn eigen paspoort:
${list}

Het gaat om herkenbaarheid, niet om dezelfde pixels.
Een andere houding, gezichtsuitdrukking of camerahoek is GEEN fout en mag geen afkeuring zijn.
Keur een personage alleen af (failed) als een kind het niet meer als hetzelfde figuur zou herkennen.
Als het figuur te klein, afgedekt of onduidelijk is: unknown. Raad niet.
passed betekent: herkenbaar hetzelfde figuur, en sceneLook klopt met de nieuwe tekening hierboven.

Beoordeel ook, los van de identiteit:
- of deze actie in de scène te zien is: ${actionLine}
- of de scène aanvoelt alsof dezelfde illustrator hem tekende als de paspoorten. ${styleLine}
Een andere pose die de actie juist laat zien is goed. Stijl en actie keuren de identiteit niet af.

Antwoord UITSLUITEND met geldige JSON, zonder markdown:
{"actionShown": true of false of null, "styleMatches": true of false of null, "characters": [{"id": "held", "verdict": "passed" of "failed" of "unknown", "sameCharacter": true of false of null, "face": true of false of null, "hair": true of false of null, "body": true of false of null, "clothes": true of false of null, "style": true of false of null, "sceneLook": "wat er op de nieuwe tekening staat", "passportLook": "wat er op het paspoort staat", "note": "korte reden"}]}
Gebruik exact deze id's: ${input.slots.join(", ") || "(geen)"}.`;
}

const LOOK_STOP = new Set([
  "een", "met", "het", "de", "van", "en", "op", "die", "dat", "voor", "naar", "niet", "ook", "maar", "zijn", "heeft", "dragen", "draagt",
]);

function lookWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !LOOK_STOP.has(word));
}

// True als sceneLook echt uit de beschrijving van de nieuwe tekening komt,
// en niet alleen de paspoortfiguur herhaalt.
export function groundedInScene(sceneLook: string, sceneDescription: string): boolean {
  const words = lookWords(sceneLook);
  if (words.length === 0) return false;
  const haystack = sceneDescription.toLowerCase();
  const hits = words.filter((word) => haystack.includes(word));
  return hits.length >= Math.min(2, words.length);
}

function mentions(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

// Een duidelijke tegenstelling, zoals blond tegen donker haar, of een jurk tegen een jas.
// Alleen als elk plaatje één kant noemt. Noemt een tekst beide, dan gokken we niet.
export function oppositeTraitConflict(sceneText: string, passportText: string): string | null {
  const pairs: [RegExp, RegExp, string][] = [
    [/blond/, /donker haar|bruin haar|zwart haar|donkerbruin/, "andere haarkleur"],
    [/\bjurk\b/, /\bjas\b|\bjack\b/, "andere kleding"],
    [/rupsband/, /antenne/, "andere robot"],
    [/\bmeisje\b/, /\bjongen\b/, "ander kind"],
  ];
  for (const [left, right, reason] of pairs) {
    const sceneLeft = mentions(sceneText, left);
    const sceneRight = mentions(sceneText, right);
    const passportLeft = mentions(passportText, left);
    const passportRight = mentions(passportText, right);
    if (sceneLeft && sceneRight) continue;
    if (passportLeft && passportRight) continue;
    if ((sceneLeft && passportRight) || (sceneRight && passportLeft)) return reason;
  }
  return null;
}

export function enforceLookSources(input: {
  characters: CharacterIdentityScore[];
  sceneDescription: string;
  passportDescriptions: Record<string, string>;
}): CharacterIdentityScore[] {
  return input.characters.map((character) => {
    if (character.verdict !== "passed") return character;
    const passportText = input.passportDescriptions[character.slot] || character.passportLook;
    const grounded = character.sceneLook ? groundedInScene(character.sceneLook, input.sceneDescription) : false;
    const conflict = oppositeTraitConflict(grounded ? character.sceneLook : input.sceneDescription, passportText);
    if (conflict) {
      return { ...character, verdict: "failed" as const, sameCharacter: false, note: conflict };
    }
    if (!grounded) {
      return {
        ...character,
        verdict: "unknown" as const,
        sameCharacter: null,
        note: "de nieuwe tekening is niet zelf beschreven",
      };
    }
    return character;
  });
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 200);
}

// Tegenspraak tussen verdict en sameCharacter wordt unknown: liever geen harde
// uitspraak dan een score waar het model zichzelf tegenspreekt.
export function normalizeVerdict(rawVerdict: unknown, sameCharacter: boolean | null): IdentityVerdict {
  const verdict = typeof rawVerdict === "string" && VERDICTS.includes(rawVerdict as IdentityVerdict)
    ? (rawVerdict as IdentityVerdict)
    : null;

  if (verdict === "passed" && sameCharacter === false) return "unknown";
  if (verdict === "failed" && sameCharacter === true) return "unknown";
  if (verdict) return verdict;
  if (sameCharacter === true) return "passed";
  if (sameCharacter === false) return "failed";
  return "unknown";
}

export function identityStatusFromCharacters(characters: CharacterIdentityScore[]): IdentityVerdict {
  if (characters.length === 0) return "unknown";
  if (characters.some((character) => character.verdict === "failed")) return "failed";
  if (characters.some((character) => character.verdict === "unknown")) return "unknown";
  return "passed";
}

function emptyScore(slot: string, note: string): CharacterIdentityScore {
  return {
    slot,
    verdict: "unknown",
    sameCharacter: null,
    face: null,
    hair: null,
    body: null,
    clothes: null,
    style: null,
    note,
    sceneLook: "",
    passportLook: "",
  };
}

export function unknownIdentityReport(input: {
  slots: IdentitySlot[];
  model: string;
  durationMs: number;
  error: string;
}): SceneIdentityReport {
  return {
    status: "unknown",
    actionShown: null,
    styleMatches: null,
    characters: input.slots.map((slot) => emptyScore(slot.slot, slot.skipReason || input.error)),
    model: input.model,
    durationMs: input.durationMs,
    inputTokens: null,
    outputTokens: null,
    influencesRetry: false,
    error: input.error,
  };
}

export function parseIdentityResponse(raw: string, slots: IdentitySlot[]): {
  actionShown: boolean | null;
  styleMatches: boolean | null;
  characters: CharacterIdentityScore[];
  error?: string;
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      actionShown: null,
      styleMatches: null,
      characters: slots.map((slot) => emptyScore(slot.slot, slot.skipReason || "onleesbaar antwoord")),
      error: "onleesbaar antwoord",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      actionShown: null,
      styleMatches: null,
      characters: slots.map((slot) => emptyScore(slot.slot, slot.skipReason || "onleesbaar antwoord")),
      error: "onleesbaar antwoord",
    };
  }

  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const rawCharacters = Array.isArray(record.characters) ? record.characters : [];

  const characters = slots.map((slot) => {
    if (!slot.passportUrl) return emptyScore(slot.slot, slot.skipReason || "geen paspoort");
    const found = rawCharacters.find((item) => {
      if (!item || typeof item !== "object") return false;
      return (item as { id?: unknown }).id === slot.slot;
    }) as Record<string, unknown> | undefined;
    if (!found) return emptyScore(slot.slot, "geen oordeel");
    const sameCharacter = asBool(found.sameCharacter);
    return {
      slot: slot.slot,
      verdict: normalizeVerdict(found.verdict, sameCharacter),
      sameCharacter,
      face: asBool(found.face),
      hair: asBool(found.hair),
      body: asBool(found.body),
      clothes: asBool(found.clothes),
      style: asBool(found.style),
      note: asNote(found.note),
      sceneLook: asNote(found.sceneLook),
      passportLook: asNote(found.passportLook),
    };
  });

  return {
    actionShown: asBool(record.actionShown),
    styleMatches: asBool(record.styleMatches),
    characters,
  };
}

export function finishIdentityReport(input: {
  slots: IdentitySlot[];
  rawText: string;
  model: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}): SceneIdentityReport {
  const parsed = parseIdentityResponse(input.rawText, input.slots);
  return {
    status: parsed.error ? "unknown" : identityStatusFromCharacters(parsed.characters),
    actionShown: parsed.actionShown,
    styleMatches: parsed.styleMatches,
    characters: parsed.characters,
    model: input.model,
    durationMs: input.durationMs,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    influencesRetry: false,
    error: parsed.error,
  };
}
