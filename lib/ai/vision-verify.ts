// Beeldverificatie: de tweede root-cause-fix. Zonder dit was elke fal.ai-aanroep tot nu
// toe "fire-and-forget" — we riepen het beeldmodel één keer aan, vertrouwden blind wat
// terugkwam, en sloegen de URL op. Niemand/niets controleerde ooit of een concreet
// gevraagd kenmerk (zoals een petje) ook echt op de afbeelding stond. Daardoor bleef dit
// soort fouten bij elke modelwissel (flux/schnell → flux/dev → flux-pro/kontext → nano
// banana 2) onopgemerkt tot een klacht weken later — er was geen feedback-loop.
//
// Dit bestand IS die feedback-loop: na elke generatie vragen we een snel, goedkoop
// vision-model (niet het dure verhaal-model) of de harde-eisen-checklist (zie
// requiredCharacterAttributes in lib/appearance.ts) echt zichtbaar is. lib/image.ts
// gebruikt dit resultaat om — indien nodig — met een aangescherpte prompt opnieuw te
// genereren (zie generateWithVerification aldaar).
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  buildIdentityPrompt,
  enforceLookSources,
  finishIdentityReport,
  identityStatusFromCharacters,
  unknownIdentityReport,
  type IdentitySlot,
  type SceneIdentityReport,
} from "@/lib/ai/identity-report";

// Een klein, snel model is hier bewust: dit is een goedkope controle-stap die vaak
// aangeroepen wordt (elke illustratie, tot 3x), niet het dure verhaal-model. Instelbaar
// via env var voor wie liever een ander model gebruikt.
const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL?.trim() || "claude-haiku-4-5";

export type AttributeCheck = {
  attributesPresent: boolean;
  missing: string[];
};

// Verificatie van losse kenmerken (petje, kleding) is een vangnet, geen harde poort.
// Als déze aanroep mislukt, gaan we ervan uit dat het kenmerk er wél is. Dat houdt de
// bestaande herkansing rustig: een storing start geen extra tekening.
// De nieuwere identiteitsmeting (observeSceneIdentity) doet dit bewust NIET. Die zegt
// bij een storing "unknown", en start nooit een tekening.
const ASSUME_OK: AttributeCheck = { attributesPresent: true, missing: [] };

const IDENTITY_TIMEOUT_MS = 8_000;

export async function verifyImageAttributes(
  imageUrl: string,
  requiredAttributes: string[],
  subjectLabel: string,
): Promise<AttributeCheck> {
  if (requiredAttributes.length === 0) return ASSUME_OK;

  const client = getAnthropicClient();
  const checklist = requiredAttributes.map((attr, i) => `${i + 1}. ${attr}`).join("\n");

  try {
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            {
              type: "text",
              text: `Kijk goed naar deze kinderboek-illustratie van ${subjectLabel}. Controleer voor ELK van de volgende kenmerken of het duidelijk zichtbaar is op de afbeelding:\n${checklist}\n\nAntwoord UITSLUITEND met geldige JSON, exact in dit formaat en niets anders (geen markdown, geen uitleg): {"attributesPresent": boolean, "missing": string[]}. "attributesPresent" is alleen true als ALLE genoemde kenmerken duidelijk te zien zijn. "missing" bevat de kenmerken die je niet duidelijk kon zien, letterlijk overgenomen uit de lijst hierboven (lege lijst als alles zichtbaar is).`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textBlock) return ASSUME_OK;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return ASSUME_OK;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<AttributeCheck>;
    if (typeof parsed.attributesPresent !== "boolean") return ASSUME_OK;

    return {
      attributesPresent: parsed.attributesPresent,
      missing: Array.isArray(parsed.missing)
        ? parsed.missing.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
        : [],
    };
  } catch (err) {
    console.warn("Beeldverificatie-aanroep mislukt (telt niet als fout, we gaan uit van OK):", err);
    return ASSUME_OK;
  }
}

type UsageSum = { input: number; output: number };

// Eén plaatje per keer. Zo kan het model het paspoort niet aanzien voor de nieuwe tekening.
async function describeOneImage(
  client: Anthropic,
  imageUrl: string,
  question: string,
  usage: UsageSum,
): Promise<string | null> {
  const response = await client.messages.create(
    {
      model: VISION_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: question },
          ],
        },
      ],
    },
    { timeout: IDENTITY_TIMEOUT_MS, maxRetries: 0 },
  );
  usage.input += response.usage?.input_tokens ?? 0;
  usage.output += response.usage?.output_tokens ?? 0;
  const text = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  const value = text?.text.trim() ?? "";
  return value || null;
}

// Vergelijkt de scène met elk paspoort. Loggen en meten, niet opnieuw tekenen.
// Eerst wordt elk plaatje apart beschreven. Pas daarna volgt de vergelijking, zonder
// de platen nog een keer naast elkaar te leggen.
export async function observeSceneIdentity(input: {
  sceneUrl: string;
  action: string;
  styleHint?: string;
  slots: IdentitySlot[];
}): Promise<SceneIdentityReport> {
  const started = Date.now();
  const comparable = input.slots.filter((slot) => slot.passportUrl);
  if (!input.sceneUrl || comparable.length === 0) {
    return unknownIdentityReport({
      slots: input.slots,
      model: VISION_MODEL,
      durationMs: Date.now() - started,
      error: input.sceneUrl ? "geen paspoort om mee te vergelijken" : "geen scène",
    });
  }

  const client = getAnthropicClient();
  const usage: UsageSum = { input: 0, output: 0 };

  try {
    const sceneDescription = await describeOneImage(
      client,
      input.sceneUrl,
      "Beschrijf alleen de figuren op DIT ene plaatje. Per figuur: soort (jongen, meisje, robot of iets anders), haarkleur of lichaamskleur, en kleding of opvallende onderdelen. Verzin niets. Noem geen paspoort.",
      usage,
    );
    if (!sceneDescription) {
      return unknownIdentityReport({
        slots: input.slots,
        model: VISION_MODEL,
        durationMs: Date.now() - started,
        error: "nieuwe tekening niet beschreven",
      });
    }

    const passportDescriptions: { slot: string; text: string }[] = [];
    for (const slot of comparable) {
      const text = await describeOneImage(
        client,
        slot.passportUrl as string,
        `Beschrijf alleen dit ene paspoort van ${slot.slot}. Soort, haarkleur of lichaamskleur, en kleding of opvallende onderdelen. Verzin niets.`,
        usage,
      );
      passportDescriptions.push({ slot: slot.slot, text: text ?? "" });
    }

    const response = await client.messages.create(
      {
        model: VISION_MODEL,
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: buildIdentityPrompt({
              action: input.action,
              slots: comparable.map((slot) => slot.slot),
              styleHint: input.styleHint,
              sceneDescription,
              passportDescriptions,
            }),
          },
        ],
      },
      { timeout: IDENTITY_TIMEOUT_MS, maxRetries: 0 },
    );
    usage.input += response.usage?.input_tokens ?? 0;
    usage.output += response.usage?.output_tokens ?? 0;
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    const report = finishIdentityReport({
      slots: input.slots,
      rawText: textBlock?.text ?? "",
      model: VISION_MODEL,
      durationMs: Date.now() - started,
      inputTokens: usage.input,
      outputTokens: usage.output,
    });
    const characters = enforceLookSources({
      characters: report.characters,
      sceneDescription,
      passportDescriptions: Object.fromEntries(passportDescriptions.map((item) => [item.slot, item.text])),
    });
    return {
      ...report,
      sceneDescription,
      characters,
      status: report.error ? "unknown" : identityStatusFromCharacters(characters),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "controle mislukt";
    console.warn("Identiteitsmeting mislukt (unknown, geen nieuwe tekening):", message);
    return unknownIdentityReport({
      slots: input.slots,
      model: VISION_MODEL,
      durationMs: Date.now() - started,
      error: message.slice(0, 200),
    });
  }
}

// Eén logregel zonder namen. De score verandert de tekening niet.
export function identityShadowLog(input: {
  storyId: string;
  chapterN: number;
  textToImageModel: string;
  editModel: string;
  attempts: number;
  attributeVerified: boolean;
  report: SceneIdentityReport;
}): string {
  return JSON.stringify({
    kind: "nuvlo-identity-shadow",
    storyId: input.storyId,
    chapterN: input.chapterN,
    textToImageModel: input.textToImageModel,
    editModel: input.editModel,
    attempts: input.attempts,
    attributeVerified: input.attributeVerified,
    identityStatus: input.report.status,
    actionShown: input.report.actionShown,
    styleMatches: input.report.styleMatches,
    visionModel: input.report.model,
    durationMs: input.report.durationMs,
    inputTokens: input.report.inputTokens,
    outputTokens: input.report.outputTokens,
    influencesRetry: false,
    error: input.report.error ?? null,
    characters: input.report.characters.map((character) => ({
      slot: character.slot,
      verdict: character.verdict,
      sameCharacter: character.sameCharacter,
      face: character.face,
      hair: character.hair,
      body: character.body,
      clothes: character.clothes,
      style: character.style,
      sceneLook: character.sceneLook,
      passportLook: character.passportLook,
    })),
  });
}
