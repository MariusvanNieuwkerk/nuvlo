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

// Een klein, snel model is hier bewust: dit is een goedkope controle-stap die vaak
// aangeroepen wordt (elke illustratie, tot 3x), niet het dure verhaal-model. Instelbaar
// via env var voor wie liever een ander model gebruikt.
const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL?.trim() || "claude-haiku-4-5";

export type AttributeCheck = {
  attributesPresent: boolean;
  missing: string[];
};

// Verificatie is een vangnet, geen harde poort: als de aanroep zelf mislukt of een
// onverwacht antwoord geeft, gaan we ervan uit dat het WEL goed is. Zo kan een storing in
// deze extra controle-stap nooit een verhaal blokkeren dat verder prima werkt.
const ASSUME_OK: AttributeCheck = { attributesPresent: true, missing: [] };

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
