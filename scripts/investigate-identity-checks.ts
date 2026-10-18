// Onderzoek, geen productiewijziging.
// 1) Keurt de nieuwe controle een ander figuur af, en laat hij een andere houding door?
// 2) Waarom zei de oude kenmerk-check dat de gele antenne ontbrak?
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/investigate-identity-checks.ts

import fs from "node:fs/promises";
import path from "node:path";
import { requiredSceneIdentityAttributes } from "@/lib/appearance";
import {
  buildIdentityPrompt,
  finishIdentityReport,
  type SceneIdentityReport,
} from "@/lib/ai/identity-report";

const DIR = path.join(process.cwd(), "output", "identity-check");
const STYLE =
  "flat colorful 2D children's picture-book illustration, soft colored pencil, warm light, consistent line weight";
const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL?.trim() || "claude-haiku-4-5";

const appearance = {
  freeform:
    "Een jongen met kort donker haar, een rode pet, een blauwe jas, een gele sjaal, een bruine broek en groene schoenen.",
  hair: "kort donker haar",
  outfit: "blauwe jas, gele sjaal, bruine broek en groene schoenen",
  accessories: ["een rode pet"],
  companion: "",
  skinOrFurTone: "",
  distinguishingFeature: "een rode pet en een gele sjaal",
};
const side = {
  name: "Wiebel",
  appearance: {
    freeform:
      "Een kleine ronde groene robot met één gele antenne, twee ronde ogen en korte grijze armpjes.",
    distinguishingFeature: "één gele antenne",
  },
};

const scenes = [
  { title: "Scène 1 zwaaien", file: "scene-1.png", action: "De jongen staat rechtop en zwaait met beide handen. De kleine robot zwaait mee." },
  { title: "Scène 2 klimmen", file: "scene-2.png", action: "De jongen klimt in de grote boom. De kleine robot kijkt van onderen omhoog." },
  { title: "Scène 3 lezen", file: "scene-3.png", action: "De jongen zit op de houten bank en leest een boek. De kleine robot zit naast hem." },
];

async function loadEnvLocal() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env al gezet
  }
}

async function png(file: string): Promise<string> {
  const buf = await fs.readFile(path.join(DIR, file));
  return buf.toString("base64");
}

function imageBlock(data: string) {
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data },
  };
}

async function main() {
  await loadEnvLocal();
  const { getAnthropicClient } = await import("@/lib/ai/client");
  const { generatePortrait, generateSideCharacterReferenceImage } = await import("@/lib/image");
  const client = getAnthropicClient();

  const baseAttrs = requiredSceneIdentityAttributes(appearance, [side], "Testheld");

  async function oldCheck(file: string, action: string) {
    const attrs = [`Deze actie is duidelijk te zien: ${action}`, ...baseAttrs];
    const list = attrs.map((attr, i) => `${i + 1}. ${attr}`).join("\n");
    const started = Date.now();
    const response = await client.messages.create(
      {
        model: VISION_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              imageBlock(await png(file)),
              {
                type: "text",
                text: `Kijk goed naar deze kinderboek-illustratie van scène met Testheld. Controleer voor ELK van de volgende kenmerken of het duidelijk zichtbaar is op de afbeelding:\n${list}\n\nAntwoord UITSLUITEND met geldige JSON, exact in dit formaat en niets anders (geen markdown, geen uitleg): {"attributesPresent": boolean, "missing": string[]}. "attributesPresent" is alleen true als ALLE genoemde kenmerken duidelijk te zien zijn. "missing" bevat de kenmerken die je niet duidelijk kon zien, letterlijk overgenomen uit de lijst hierboven (lege lijst als alles zichtbaar is).`,
              },
            ],
          },
        ],
      },
      { timeout: 20000, maxRetries: 0 },
    );
    const text = response.content.find((block) => block.type === "text");
    const raw = text && text.type === "text" ? text.text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: { attributesPresent?: boolean; missing?: string[] } = {};
    try {
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }
    return {
      file,
      durationMs: Date.now() - started,
      attributesPresent: parsed.attributesPresent === true,
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      raw,
    };
  }

  async function antennaQuestion(file: string) {
    const response = await client.messages.create(
      {
        model: VISION_MODEL,
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              imageBlock(await png(file)),
              {
                type: "text",
                text: "Kijk alleen naar de kleine groene robot. Zie je een gele antenne op zijn hoofd? Antwoord in het Nederlands, in één zin, en begin met ja of nee.",
              },
            ],
          },
        ],
      },
      { timeout: 20000, maxRetries: 0 },
    );
    const text = response.content.find((block) => block.type === "text");
    return text && text.type === "text" ? text.text.trim() : "";
  }

  async function newCheck(
    sceneFile: string,
    passports: { slot: string; file: string }[],
    action: string,
  ): Promise<SceneIdentityReport> {
    const started = Date.now();
    const content: Array<
      | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }
      | { type: "text"; text: string }
    > = [imageBlock(await png(sceneFile)), { type: "text", text: "Beeld 1 is de nieuwe scène." }];
    for (const passport of passports) {
      content.push(imageBlock(await png(passport.file)));
      content.push({ type: "text", text: `Dit beeld is het paspoort van ${passport.slot}.` });
    }
    content.push({
      type: "text",
      text: buildIdentityPrompt({
        action,
        slots: passports.map((passport) => passport.slot),
        styleHint: STYLE,
        sceneDescription: "Beeld 1 is de nieuwe tekening.",
        passportDescriptions: passports.map((passport) => ({
          slot: passport.slot,
          text: `Het paspoortbeeld van ${passport.slot}.`,
        })),
      }),
    });
    const response = await client.messages.create(
      { model: VISION_MODEL, max_tokens: 700, messages: [{ role: "user", content }] },
      { timeout: 20000, maxRetries: 0 },
    );
    const text = response.content.find((block) => block.type === "text");
    return finishIdentityReport({
      slots: passports.map((passport) => ({ slot: passport.slot, passportUrl: passport.file })),
      rawText: text && text.type === "text" ? text.text : "",
      model: VISION_MODEL,
      durationMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    });
  }

  if (process.argv.includes("--recheck")) {
    console.log("Alleen de verkeerde figuren nog eens vergelijken…");
    for (let n = 1; n <= 2; n++) {
      const heroAgain = await newCheck("fout-held.png", [{ slot: "held", file: "paspoort-held.png" }], "Een ander kind staat stil.");
      const robotAgain = await newCheck(
        "fout-robot.png",
        [{ slot: "bijfiguur-1", file: "paspoort-bijfiguur.png" }],
        "Een andere robot staat stil.",
      );
      console.log(`Ronde ${n} ander kind: ${heroAgain.status} — ${heroAgain.characters[0]?.note}`);
      console.log(`Ronde ${n} andere robot: ${robotAgain.status} — ${robotAgain.characters[0]?.note}`);
    }
    return;
  }

  console.log("Oude check opnieuw op de drie goede scènes…");
  const oldResults = [];
  for (const scene of scenes) {
    const result = await oldCheck(scene.file, scene.action);
    const antenna = await antennaQuestion(scene.file);
    oldResults.push({ title: scene.title, ...result, antennaAnswer: antenna });
    console.log(
      `${scene.title}: oude check ${result.attributesPresent ? "goed" : "afgekeurd"} · ontbreekt: ${result.missing.join(" | ") || "niets"}`,
    );
    console.log(`  directe vraag antenne: ${antenna}`);
  }

  const both = [
    { slot: "held", file: "paspoort-held.png" },
    { slot: "bijfiguur-1", file: "paspoort-bijfiguur.png" },
  ];

  console.log("\nNieuwe check op dezelfde scènes (andere houding en camera)…");
  const poseResults = [];
  for (const scene of scenes) {
    const report = await newCheck(scene.file, both, scene.action);
    poseResults.push({
      title: scene.title,
      status: report.status,
      actionShown: report.actionShown,
      styleMatches: report.styleMatches,
      characters: report.characters.map((character) => ({
        slot: character.slot,
        verdict: character.verdict,
        note: character.note,
      })),
    });
    console.log(`${scene.title}: identiteit ${report.status}, actie ${String(report.actionShown)}`);
  }

  console.log("\nVerkeerde figuren tekenen…");
  const wrongHero = await generatePortrait(
    {
      freeform: "Een meisje met lang blond haar, sproeten, een paarse stippenjurk en roze schoenen. Geen pet en geen sjaal.",
      hair: "lang blond haar",
      outfit: "paarse stippenjurk en roze schoenen",
      accessories: [],
      companion: "",
      skinOrFurTone: "",
      distinguishingFeature: "lang blond haar en een paarse jurk",
    },
    "ze staat stil",
    STYLE,
    null,
  );
  if (!wrongHero.url) throw new Error("verkeerde held lukte niet");
  const heroRes = await fetch(wrongHero.url);
  await fs.writeFile(path.join(DIR, "fout-held.png"), Buffer.from(await heroRes.arrayBuffer()));

  const wrongRobot = await generateSideCharacterReferenceImage(
    {
      name: "Blauw",
      appearance: {
        freeform: "Een grote blauwe vierkante robot op rupsbanden, met één groot rood oog en geen antenne.",
        distinguishingFeature: "één groot rood oog en rupsbanden",
      },
      referenceImageUrl: null,
    },
    STYLE,
    null,
  );
  if (!wrongRobot.url) throw new Error("verkeerde robot lukte niet");
  const robotRes = await fetch(wrongRobot.url);
  await fs.writeFile(path.join(DIR, "fout-robot.png"), Buffer.from(await robotRes.arrayBuffer()));
  console.log(`Verkeerde held: ${wrongHero.attempts} poging(en). Verkeerde robot: ${wrongRobot.attempts} poging(en).`);

  console.log("Nieuwe check op de verkeerde figuren…");
  const wrongHeroReport = await newCheck("fout-held.png", [{ slot: "held", file: "paspoort-held.png" }], "Een ander kind staat stil.");
  const wrongRobotReport = await newCheck(
    "fout-robot.png",
    [{ slot: "bijfiguur-1", file: "paspoort-bijfiguur.png" }],
    "Een andere robot staat stil.",
  );
  console.log(`Ander kind tegen paspoort held: ${wrongHeroReport.status} — ${wrongHeroReport.characters[0]?.note}`);
  console.log(`Andere robot tegen paspoort robot: ${wrongRobotReport.status} — ${wrongRobotReport.characters[0]?.note}`);

  const report = {
    oldCheck: oldResults,
    poseCheck: poseResults,
    wrongHero: {
      attempts: wrongHero.attempts,
      status: wrongHeroReport.status,
      note: wrongHeroReport.characters[0]?.note ?? "",
      sameCharacter: wrongHeroReport.characters[0]?.sameCharacter ?? null,
    },
    wrongRobot: {
      attempts: wrongRobot.attempts,
      status: wrongRobotReport.status,
      note: wrongRobotReport.characters[0]?.note ?? "",
      sameCharacter: wrongRobotReport.characters[0]?.sameCharacter ?? null,
    },
  };
  await fs.writeFile(path.join(DIR, "onderzoek.json"), JSON.stringify(report, null, 2));
  console.log("\nOpgeslagen:", path.join(DIR, "onderzoek.json"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
