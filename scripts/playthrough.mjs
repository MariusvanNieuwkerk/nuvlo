// Fase 3 hulpmiddel: speelt één verhaal volledig uit tegen de draaiende dev-server,
// kiest elke keer automatisch een optie, en print elke scène met woordtelling.
// Gebruik: node scripts/playthrough.mjs
// Optioneel: PICK=random node scripts/playthrough.mjs  (kiest willekeurig i.p.v. altijd A)

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PICK = process.env.PICK || "first";
const MAX_CHAPTERS = Number(process.env.MAX_CHAPTERS || 25);

const hero = {
  name: "Sem",
  world: "het Fluisterbos",
  power: "onzichtbaar worden",
  weakness: "kan niet goed geheimen bewaren",
  enemy: "de Knagerkoning",
  genre: "avontuur",
};
const age = 8;
const appearance = "donkerbruin stekelhaar, een groene trui met een ster erop, blauwe sneakers";

function words(text) {
  return text.trim().split(/\s+/).length;
}

function pickChoice(choices) {
  if (PICK === "random") return choices[Math.floor(Math.random() * choices.length)];
  return choices[0];
}

async function main() {
  console.log(`\n=== NIEUW VERHAAL (held: ${hero.name}, ${age} jaar) ===\n`);

  const startRes = await fetch(`${BASE}/api/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hero, age, appearance }),
  });
  if (!startRes.ok) {
    console.error("Start mislukt:", startRes.status, await startRes.text());
    process.exit(1);
  }
  let { story } = await startRes.json();

  console.log(`TITEL: ${story.title}\n`);
  console.log("VERHAALBIJBEL (geheim):");
  story.bible.aktes.forEach((a, i) => console.log(`  Akte ${i + 1}: ${a}`));
  console.log("");

  let guard = 0;
  while (guard++ < 25) {
    const chapter = story.chapters[story.chapters.length - 1];
    console.log(`\n----- HOOFDSTUK ${chapter.n} (${words(chapter.text)} woorden) -----`);
    console.log(chapter.text);
    console.log(`\n[samenvatting] ${story.summary}`);
    console.log(`[open draadjes] ${story.bible.openThreads.join(" | ") || "geen"}`);

    if (story.status === "klaar" || chapter.choices.length === 0) {
      console.log("\n=== EINDE ===");
      break;
    }

    if (chapter.n >= MAX_CHAPTERS) {
      console.log(`\n=== GESTOPT na ${MAX_CHAPTERS} hoofdstukken (MAX_CHAPTERS) ===`);
      break;
    }

    console.log("\nKEUZES:");
    chapter.choices.forEach((c, i) => console.log(`  ${String.fromCharCode(65 + i)}. ${c}`));
    const choice = pickChoice(chapter.choices);
    console.log(`\n>>> Gekozen: ${choice}`);

    const res = await fetch(`${BASE}/api/stories/${story.id}/choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    if (!res.ok) {
      console.error("Keuze mislukt:", res.status, await res.text());
      process.exit(1);
    }
    ({ story } = await res.json());
  }

  console.log(`\nSTORY_ID=${story.id}`);
  console.log(`Totaal hoofdstukken: ${story.chapters.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
