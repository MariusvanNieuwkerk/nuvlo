// Tien scènes plus expres verkeerde figuren.
// De score tekent niets extra. Eerst blind.html bekijken, daarna ai.html.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/check-identity-ten.ts

import fs from "node:fs/promises";
import path from "node:path";
import { buildSceneIdentitySlots } from "@/lib/ai/identity-report";
import type { SceneIdentityReport } from "@/lib/ai/identity-report";

const DIR = path.join(process.cwd(), "output", "identity-ten");
const STYLE =
  "flat colorful 2D children's picture-book illustration, soft colored pencil, warm light, consistent line weight";

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
    freeform: "Een kleine ronde groene robot met één gele antenne, twee ronde ogen en korte grijze armpjes.",
    distinguishingFeature: "één gele antenne",
  },
  referenceImageUrl: null as string | null,
};

const world = {
  freeform: "De plek uit de opdracht, met genoeg ruimte om de figuren te zien.",
  setting: "wisselend",
  paletteAndAtmosphere: "warm licht",
  landmark: "",
};

const scenes = [
  "Vooraanzicht in een park. De jongen zwaait met beide handen. De kleine robot zwaait mee.",
  "Laag standpunt. De jongen klimt in een grote boom. De kleine robot kijkt van onderen omhoog.",
  "Zijaanzicht. De jongen zit op een bank en leest een boek. De kleine robot zit naast hem.",
  "Van opzij. De jongen rent over een houten brug. De kleine robot rent achter hem aan.",
  "Driekwart, avondlicht. De jongen zit bij een klein kampvuur. De kleine robot zit tegenover hem.",
  "Van achteren. De jongen wijst naar een sterrenhemel. De kleine robot staat naast hem en kijkt ook omhoog.",
  "Dichterbij, tot de knieën. De jongen houdt een gele paraplu vast in de regen. De kleine robot staat onder de paraplu.",
  "Hoge camera. De jongen danst op een plein. De kleine robot danst naast hem.",
  "In een tent, liggend. De jongen ligt op zijn zij. De kleine robot zit bij zijn voeten.",
  "Veraf, kleine figuren. De jongen en de kleine robot staan op een boot op een meer.",
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

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download mislukt (${res.status})`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

type Row = {
  title: string;
  expected: "passed" | "failed";
  file: string;
  drawMs: number;
  attempts: number;
  report: SceneIdentityReport | null;
};

function judgedStatus(row: Row): string {
  const relevant = (row.report?.characters ?? []).filter(
    (character) =>
      character.note !== "tijdelijke vorm, paspoort niet vergeleken" && character.note !== "geen paspoort",
  );
  if (relevant.some((character) => character.verdict === "failed")) return "failed";
  if (relevant.length > 0 && relevant.every((character) => character.verdict === "passed")) return "passed";
  return "unknown";
}

function bucket(row: Row): string {
  const status = judgedStatus(row);
  if (row.expected === "passed" && status === "passed") return "terecht goedgekeurd";
  if (row.expected === "passed" && status === "failed") return "onterecht afgekeurd";
  if (row.expected === "failed" && status === "failed") return "terecht afgekeurd";
  if (row.expected === "failed" && status === "passed") return "onterecht goedgekeurd";
  return "weet niet";
}

async function main() {
  await loadEnvLocal();
  const { generatePortrait, generateSceneImage, generateSideCharacterReferenceImage } = await import("@/lib/image");
  const { observeSceneIdentity } = await import("@/lib/ai/vision-verify");
  await fs.mkdir(DIR, { recursive: true });

  console.log("Paspoorten…");
  const heroStarted = Date.now();
  const hero = await generatePortrait(appearance, "het avontuur begint net", STYLE, null);
  const heroMs = Date.now() - heroStarted;
  if (!hero.url) throw new Error("paspoort held lukte niet");
  await download(hero.url, path.join(DIR, "paspoort-held.png"));

  const sideStarted = Date.now();
  const sideRef = await generateSideCharacterReferenceImage(side, STYLE, null);
  const sideMs = Date.now() - sideStarted;
  if (!sideRef.url) throw new Error("paspoort robot lukte niet");
  side.referenceImageUrl = sideRef.url;
  await download(sideRef.url, path.join(DIR, "paspoort-bijfiguur.png"));
  console.log(`Paspoorten klaar. Pogingen held ${hero.attempts}, robot ${sideRef.attempts}.`);

  const rows: Row[] = [];
  for (let index = 0; index < scenes.length; index++) {
    const action = scenes[index];
    const title = `Scène ${index + 1}`;
    console.log(`${title} tekenen…`);
    const started = Date.now();
    const image = await generateSceneImage(action, appearance, STYLE, world, [side], hero.url, null, null, null, "Testheld");
    const drawMs = Date.now() - started;
    if (!image.url) {
      rows.push({ title, expected: "passed", file: "", drawMs, attempts: image.attempts, report: null });
      console.log(`${title} lukte niet.`);
      continue;
    }
    const file = `scene-${index + 1}.png`;
    await download(image.url, path.join(DIR, file));
    const report = await observeSceneIdentity({
      sceneUrl: image.url,
      action,
      styleHint: STYLE,
      slots: buildSceneIdentitySlots({
        heroPassportUrl: hero.url,
        compareHero: true,
        sidePassportUrls: [side.referenceImageUrl],
      }),
    });
    rows.push({ title, expected: "passed", file, drawMs, attempts: image.attempts, report });
    console.log(`${title}: ${drawMs} ms, pogingen ${image.attempts}, identiteit ${report.status}`);
  }

  const wrongs: { title: string; file: string; draw: () => Promise<{ url: string | null; attempts: number }>; slot: "held" | "bijfiguur-1"; passport: string }[] = [
    {
      title: "Ander kind: blond meisje",
      file: "fout-meisje.png",
      slot: "held",
      passport: hero.url,
      draw: async () =>
        generatePortrait(
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
        ),
    },
    {
      title: "Ander kind: rode krullen",
      file: "fout-jongen.png",
      slot: "held",
      passport: hero.url,
      draw: async () =>
        generatePortrait(
          {
            freeform: "Een jongen met wilde rode krullen, een groene overall en gele laarzen. Geen pet en geen sjaal.",
            hair: "wilde rode krullen",
            outfit: "groene overall en gele laarzen",
            accessories: [],
            companion: "",
            skinOrFurTone: "",
            distinguishingFeature: "wilde rode krullen en een groene overall",
          },
          "hij staat stil",
          STYLE,
          null,
        ),
    },
    {
      title: "Andere robot",
      file: "fout-robot.png",
      slot: "bijfiguur-1",
      passport: side.referenceImageUrl as string,
      draw: async () =>
        generateSideCharacterReferenceImage(
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
        ),
    },
  ];

  for (const wrong of wrongs) {
    console.log(`${wrong.title} tekenen…`);
    const started = Date.now();
    const image = await wrong.draw();
    const drawMs = Date.now() - started;
    if (!image.url) {
      rows.push({ title: wrong.title, expected: "failed", file: "", drawMs, attempts: image.attempts, report: null });
      continue;
    }
    await download(image.url, path.join(DIR, wrong.file));
    const report = await observeSceneIdentity({
      sceneUrl: image.url,
      action: "Dit figuur staat stil.",
      styleHint: STYLE,
      slots: buildSceneIdentitySlots({
        heroPassportUrl: wrong.slot === "held" ? wrong.passport : null,
        compareHero: wrong.slot === "held",
        sidePassportUrls: wrong.slot === "bijfiguur-1" ? [wrong.passport] : [],
      }),
    });
    rows.push({ title: wrong.title, expected: "failed", file: wrong.file, drawMs, attempts: image.attempts, report });
    console.log(`${wrong.title}: identiteit ${report.status} — ${report.characters[0]?.note}`);
  }

  const counts: Record<string, number> = {};
  for (const row of rows) counts[bucket(row)] = (counts[bucket(row)] ?? 0) + 1;
  const drawMs = rows.reduce((sum, row) => sum + row.drawMs, 0) + heroMs + sideMs;
  const inputTokens = rows.reduce((sum, row) => sum + (row.report?.inputTokens ?? 0), 0);
  const outputTokens = rows.reduce((sum, row) => sum + (row.report?.outputTokens ?? 0), 0);
  const imageCount = 2 + rows.filter((row) => row.file).length;

  const summary = {
    counts,
    imageCount,
    drawMs,
    heroAttempts: hero.attempts,
    sideAttempts: sideRef.attempts,
    maxAttempts: Math.max(hero.attempts, sideRef.attempts, ...rows.map((row) => row.attempts)),
    inputTokens,
    outputTokens,
    note: "Geen euro-schatting. Het aantal tekeningen en de tokens staan hierboven. Een tweede tekening op basis van de kenmerk-check staat uit.",
    rows: rows.map((row) => ({
      title: row.title,
      expected: row.expected,
      bucket: bucket(row),
      file: row.file,
      drawMs: row.drawMs,
      attempts: row.attempts,
      status: judgedStatus(row),
      overall: row.report?.status ?? null,
      sceneDescription: row.report?.sceneDescription ?? "",
      characters: row.report?.characters.map((character) => ({
        slot: character.slot,
        verdict: character.verdict,
        sceneLook: character.sceneLook,
        passportLook: character.passportLook,
        note: character.note,
      })) ?? [],
    })),
  };
  await fs.writeFile(path.join(DIR, "result.json"), JSON.stringify(summary, null, 2));

  const cards = rows
    .filter((row) => row.file && row.expected === "passed")
    .map(
      (row) => `<section><h2>${escapeHtml(row.title)}</h2><img src="${escapeHtml(row.file)}" alt=""><p>Zelfde held? Zelfde robot? Zelfde stijl? ja / nee / weet niet</p></section>`,
    )
    .join("\n");
  await fs.writeFile(
    path.join(DIR, "blind.html"),
    `<!doctype html><html lang="nl"><meta charset="utf-8"><title>Blinde kijk</title>
    <style>body{font-family:Georgia,serif;background:#f7f2e8;color:#243028;max-width:720px;margin:0 auto;padding:32px 20px 80px}img{width:100%;border-radius:16px}.pass{display:flex;gap:12px}.pass img{height:220px;object-fit:contain;background:#fffaf3}</style>
    <h1>Zijn dit dezelfde figuren?</h1><p>Kijk eerst alleen hier. Een andere houding of camera mag.</p>
    <div class="pass"><figure><img src="paspoort-held.png" alt=""><figcaption>Paspoort held</figcaption></figure><figure><img src="paspoort-bijfiguur.png" alt=""><figcaption>Paspoort robot</figcaption></figure></div>
    ${cards}</html>`,
  );
  const ai = summary.rows
    .map(
      (row) => `<section><h2>${escapeHtml(row.title)} — ${escapeHtml(row.bucket)}</h2>${row.file ? `<img src="${escapeHtml(row.file)}" alt="">` : "<p>Geen tekening.</p>"}<p>${row.drawMs} ms · pogingen ${row.attempts}</p><p>${escapeHtml(row.sceneDescription)}</p><ul>${row.characters.map((character) => `<li>${escapeHtml(character.slot)}: ${escapeHtml(character.verdict)} — nieuw: ${escapeHtml(character.sceneLook)} — paspoort: ${escapeHtml(character.passportLook)} — ${escapeHtml(character.note)}</li>`).join("")}</ul></section>`,
    )
    .join("\n");
  await fs.writeFile(
    path.join(DIR, "ai.html"),
    `<!doctype html><html lang="nl"><meta charset="utf-8"><title>AI-scores</title>
    <style>body{font-family:Georgia,serif;background:#f7f2e8;color:#243028;max-width:800px;margin:0 auto;padding:32px 20px 80px}img{width:100%;border-radius:16px}</style>
    <h1>AI-scores</h1><p>Open dit pas na de blinde pagina. Tekeningen: ${imageCount}. Tekentijd: ${drawMs} ms. Tokens in ${inputTokens}, uit ${outputTokens}. Geen euro-bedrag.</p>${ai}</html>`,
  );

  console.log("\nTelling:", counts);
  console.log(`Tekeningen: ${imageCount}. Tekentijd: ${drawMs} ms. Hoogste pogingen: ${summary.maxAttempts}.`);
  console.log("Eerst:", path.join(DIR, "blind.html"));
  console.log("Daarna:", path.join(DIR, "ai.html"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
