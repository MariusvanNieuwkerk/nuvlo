// Controleert de leesvolgorde en "alleen nieuwe figuren opslaan".
// Daarna zet het een kort testboek van 4 hoofdstukken in de database.
//
//   npx tsx scripts/test-read-flow.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/test-read-flow.ts

import fs from "node:fs/promises";
import path from "node:path";
import { newlyIntroducedSideCharacters } from "@/lib/new-side-characters";
import type { Chapter, SideCharacter } from "@/lib/types";

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

function side(name: string, dismissed = false): SideCharacter {
  return {
    name,
    appearance: { freeform: `${name} uit het testverhaal`, distinguishingFeature: name },
    referenceImageUrl: null,
    dismissed,
  };
}

function chapter(n: number, names: string[]): Pick<Chapter, "sceneCharacterNames"> {
  return { sceneCharacterNames: names };
}

function namesOf(list: SideCharacter[]): string[] {
  return list.map((c) => c.name);
}

function assert(ok: boolean, message: string) {
  if (!ok) throw new Error(message);
}

function pageOrder(opts: { isChapterEnd: boolean; isLast: boolean; newCharCount: number }) {
  const blocks = ["tekst"];
  if (opts.isChapterEnd) blocks.push("tekening");
  if (opts.isLast && opts.newCharCount > 0) blocks.push("nieuwe-figuren");
  if (opts.isLast) blocks.push("keuzes");
  return blocks;
}

function runLogicTests() {
  const bible = [side("Vonk"), side("Mira"), side("Pip"), side("Noor")];
  const empty = new Set<string>();

  const ch1 = newlyIntroducedSideCharacters(
    [chapter(1, ["Vonk"])],
    bible,
    empty,
    "Noor",
  );
  assert(namesOf(ch1).join() === "Vonk", `hoofdstuk 1 moet alleen Vonk tonen, kreeg: ${namesOf(ch1)}`);

  const ch2 = newlyIntroducedSideCharacters(
    [chapter(1, ["Vonk"]), chapter(2, ["Vonk"])],
    bible,
    empty,
    "Noor",
  );
  assert(ch2.length === 0, `hoofdstuk 2 mag geen oude figuren tonen, kreeg: ${namesOf(ch2)}`);

  const ch3 = newlyIntroducedSideCharacters(
    [chapter(1, ["Vonk"]), chapter(2, ["Vonk"]), chapter(3, ["Vonk", "Mira"])],
    bible,
    empty,
    "Noor",
  );
  assert(namesOf(ch3).join() === "Mira", `hoofdstuk 3 moet alleen Mira tonen, kreeg: ${namesOf(ch3)}`);

  const ch4 = newlyIntroducedSideCharacters(
    [
      chapter(1, ["Vonk"]),
      chapter(2, ["Vonk"]),
      chapter(3, ["Vonk", "Mira"]),
      chapter(4, ["Vonk", "Mira", "Pip"]),
    ],
    bible,
    empty,
    "Noor",
  );
  assert(namesOf(ch4).join() === "Pip", `hoofdstuk 4 moet alleen Pip tonen, kreeg: ${namesOf(ch4)}`);

  const alreadySaved = newlyIntroducedSideCharacters(
    [chapter(1, ["Vonk"])],
    bible,
    new Set(["vonk"]),
    "Noor",
  );
  assert(alreadySaved.length === 0, "al opgeslagen figuur mag geen knop krijgen");

  const heroAsSide = newlyIntroducedSideCharacters(
    [chapter(1, ["Noor"])],
    bible,
    empty,
    "Noor",
  );
  assert(heroAsSide.length === 0, "de held mag nooit een opslaan-knop krijgen");

  const firstPage = pageOrder({ isChapterEnd: false, isLast: false, newCharCount: 1 });
  assert(
    firstPage.join(" → ") === "tekst",
    `eerste bladzijde moet alleen tekst zijn, kreeg: ${firstPage.join(" → ")}`,
  );

  const lastLive = pageOrder({ isChapterEnd: true, isLast: true, newCharCount: 1 });
  assert(
    lastLive.join(" → ") === "tekst → tekening → nieuwe-figuren → keuzes",
    `laatste bladzijde moet tekst → tekening → nieuwe-figuren → keuzes zijn, kreeg: ${lastLive.join(" → ")}`,
  );

  const lastWithoutNew = pageOrder({ isChapterEnd: true, isLast: true, newCharCount: 0 });
  assert(
    lastWithoutNew.join(" → ") === "tekst → tekening → keuzes",
    `zonder nieuwe figuur geen opslaan-vak, kreeg: ${lastWithoutNew.join(" → ")}`,
  );

  console.log("Logica-test: alle checks geslaagd.");
}

async function createTestStory() {
  const { createStory, getDefaultChild } = await import("@/lib/storage");
  const child = await getDefaultChild();

  const story = await createStory({
    childId: child.id,
    title: "Noor in het Fluisterbos",
    authorName: "Test",
    authorAge: 8,
    hero: {
      name: "Noor",
      world: "het Fluisterbos",
      power: "praten met dieren",
      weakness: "snel schrikken",
      enemy: "de Knagerkoning",
      genre: "avontuur",
    },
    character: {
      appearance: {
        freeform: "donker haar in twee vlechten, een gele jas, rode laarzen",
        hair: "donker haar in twee vlechten",
        outfit: "een gele jas en rode laarzen",
        accessories: [],
        companion: "",
        skinOrFurTone: "",
        distinguishingFeature: "een gele jas",
      },
      imageStyleHint: "flat colorful 2D children's picture-book illustration style",
      items: [],
      portraitUrl: null,
      pendingPortraitUrl: null,
    },
    bible: {
      aktes: [
        "Noor hoort iets in het Fluisterbos.",
        "Vonk het drakenjong vraagt om hulp.",
        "Mira de uil wijst de weg.",
        "Pip de eekhoorn brengt een briefje.",
        "Samen durven ze verder.",
      ],
      openThreads: ["Wie is de Knagerkoning?"],
      worldAppearance: {
        freeform: "Een stil, groen bos met hoge bomen en zacht licht tussen de bladeren.",
        setting: "een stil groen bos",
        paletteAndAtmosphere: "groen, goud licht, rustig",
        landmark: "een oude eik met een holle stam",
      },
      worldReferenceImageUrl: null,
      sideCharacters: [
        side("Vonk"),
        side("Mira"),
        side("Pip"),
      ],
    },
    summary: "Noor ontmoet in het Fluisterbos eerst Vonk, later Mira en daarna Pip.",
    status: "bezig",
    coverUrl: null,
    favorite: false,
    chapters: [
      {
        n: 1,
        pages: [
          "Noor zet haar rode laarzen in het zachte mos. Het Fluisterbos is stil. Te stil.",
          "\"Hallo?\" roept ze. Alleen de bladeren bewegen. Dan hoort ze een klein gepiep.",
          "Uit de holle eik schiet een klein groen drakenjong. \"Help!\" piept het. \"De Knagerkoning komt eraan!\"",
        ],
        choices: [
          "Noor vraagt hoe het drakenjong heet.",
          "Noor verstopt zich achter de eik.",
          "Noor fluistert dat ze samen verdergaan.",
        ],
        chosen: "Noor vraagt hoe het drakenjong heet.",
        imagePrompt: "Een klein groen drakenjong springt uit een holle eik naar een meisje in een gele jas.",
        imageUrl: null,
        imagePending: false,
        sceneCharacterNames: ["Vonk"],
      },
      {
        n: 2,
        pages: [
          "\"Ik heet Vonk,\" zegt het drakenjong. Zijn gouden vleugels trillen.",
          "Noor knielt. \"Ik ben Noor. Ik kan met dieren praten. Vertel maar rustig.\"",
          "Vonk wijst dieper het bos in. \"Daar brandt een rood licht. Durf je mee?\"",
        ],
        choices: [
          "Noor loopt met Vonk naar het rode licht.",
          "Noor klimt eerst in de eik om te kijken.",
          "Noor zoekt een stok om zich dapper te voelen.",
        ],
        chosen: "Noor loopt met Vonk naar het rode licht.",
        imagePrompt: "Noor en Vonk kijken samen naar een rood licht diep tussen de bomen.",
        imageUrl: null,
        imagePending: false,
        sceneCharacterNames: ["Vonk"],
      },
      {
        n: 3,
        pages: [
          "Het rode licht blijkt een lantaarn. Op een tak zit een uil met een blauwe strik.",
          "\"Eindelijk,\" hoest de uil. \"Ik ben Mira. Jullie zoeken de Knagerkoning, toch?\"",
          "Mira knikt naar een smal pad. \"Volg de eikels. En let op. Iemand volgt jullie.\"",
        ],
        choices: [
          "Noor vraagt wie hen volgt.",
          "Noor volgt meteen de eikels.",
          "Noor bedankt Mira en blijft even staan.",
        ],
        chosen: "Noor vraagt wie hen volgt.",
        imagePrompt: "Een uil met een blauwe strik zit op een tak boven Noor en Vonk.",
        imageUrl: null,
        imagePending: false,
        sceneCharacterNames: ["Vonk", "Mira"],
      },
      {
        n: 4,
        pages: [
          "Achter een wortel piept een eekhoorn met een te groot mutsje. \"Wacht!\"",
          "\"Ik ben Pip. Ik heb een briefje gestolen van de Knagerkoning. Kijk.\"",
          "Op het briefje staat één zin: \"Morgen bij de oude brug.\" Noor slikt. Wat nu?",
        ],
        choices: [
          "Noor leest het briefje hardop voor.",
          "Noor vraagt Pip om mee te gaan naar de brug.",
          "Noor verstopt het briefje in haar jas.",
        ],
        chosen: null,
        imagePrompt: "Een eekhoorn met een te groot mutsje geeft Noor een klein briefje.",
        imageUrl: null,
        imagePending: false,
        sceneCharacterNames: ["Vonk", "Mira", "Pip"],
      },
    ],
  });

  const empty = new Set<string>();
  const latest = newlyIntroducedSideCharacters(
    story.chapters,
    story.bible.sideCharacters,
    empty,
    story.hero.name,
  );
  assert(namesOf(latest).join() === "Pip", `opgeslagen boek moet alleen Pip als nieuw tonen, kreeg: ${namesOf(latest)}`);

  console.log(`Testboek gezet: ${story.title}`);
  console.log(`id=${story.id}`);
  console.log(`Open: /verhaal/${story.id}/lezen`);
  console.log("Op de laatste bladzijde hoor je alleen Pip te kunnen opslaan, niet Noor, Vonk of Mira.");
}

async function main() {
  runLogicTests();
  await loadEnvLocal();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Geen database-sleutels gevonden, dus geen testboek gezet.");
    return;
  }
  await createTestStory();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
