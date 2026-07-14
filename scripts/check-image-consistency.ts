// Herhaalbare regressie-check voor de beeld-pijplijn (lib/image.ts).
//
// WAAROM dit script bestaat: zonder een herhaalbare check bleef elke wijziging aan een
// prompt of een modelwissel een gok — "ship it en wacht op de volgende klacht". Dit
// script draait de ECHTE pijplijn (portret → scène-met-referentie) tegen een bekende,
// lastige fixture (het uiterlijk van Rens: een petje achterstevoren, dat er eerder
// steeds niet stond) en gebruikt dezelfde vision-verificatie als de app zelf om
// automatisch te bevestigen dat de verplichte kenmerken ook echt op de afbeelding staan.
//
// UITVOEREN (nodig vanwege de "server-only"-marker in lib/image.ts — het
// react-server-conditie-argument zorgt ervoor dat Node die marker overslaat, precies
// zoals Next.js dat intern ook doet bij het bundelen van server-only code):
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/check-image-consistency.ts
//
// Vereist een geldige FAL_KEY en ANTHROPIC_API_KEY in .env.local. Kost een paar echte
// fal.ai + Anthropic-aanroepen (dus niet in een snelle CI-loop zonder nadenken draaien),
// maar telt niet mee voor de dagelijkse kind-quota (dit script roept lib/image.ts direct
// aan, niet via de API-routes die de quota afdwingen).
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

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
    // Geen .env.local gevonden — ga ervan uit dat de env vars al op een andere manier gezet zijn.
  }
}

async function download(url: string, filename: string): Promise<string> {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(os.tmpdir(), filename);
  await fs.writeFile(dest, buf);
  return dest;
}

async function main() {
  await loadEnvLocal();

  // Late imports (na het laden van .env.local, en om zeker te zijn dat de
  // react-server-conditie-truc al actief is voordat lib/image.ts geïmporteerd wordt).
  const { generatePortrait, generateSceneImage, generateWorldReferenceImage, generateSideCharacterReferenceImage } =
    await import("@/lib/image");
  const { requiredCharacterAttributes } = await import("@/lib/appearance");
  const { verifyImageAttributes } = await import("@/lib/ai/vision-verify");

  // Vaste fixture: het bekende, lastige geval van Rens — een petje achterstevoren, dat
  // er bij het oude flux/dev+kontext-model steeds NIET op stond.
  const appearance = {
    freeform: "Een jongen met donker haar, gekleed in een groen-blauw gestreept shirt en met een petje achterstevoren op zijn hoofd.",
    hair: "donker haar",
    outfit: "groen-blauw gestreept shirt",
    accessories: ["een petje achterstevoren op zijn hoofd"],
    companion: "",
    skinOrFurTone: "",
    distinguishingFeature: "een petje achterstevoren op zijn hoofd",
  };
  const world = {
    freeform: "Een eindeloze sterrenhemel vol fonkelende sterren in duizend kleuren, met zachte glanzende wolken als paden en glinsterende sterrenstof die als glitter door de lucht zweeft. Hier en daar drijven kleine planeetjes met ronde, vriendelijke vormen. Sommige plekken zijn donker en stil, zonder licht.",
    setting: "een eindeloze sterrenhemel",
    paletteAndAtmosphere: "fonkelende sterren in duizend kleuren, glinsterende sterrenstof",
    landmark: "een donkere plek zonder sterren, en een klein glinsterend groen steentje",
  };
  const styleHint =
    "anime style, big sparkly expressive eyes, cel-shaded, vibrant spiky hair, clean bold outlines, dynamic action pose";
  const chapter1ImagePrompt =
    "Een jongen zweeft vrolijk met gespreide armen boven een zee van fonkelende sterren in duizend kleuren. In de verte is een donkere plek zonder sterren te zien, en op een wolk vlakbij hem glinstert een klein groen steentje.";

  let failed = false;

  console.log("=== Stap 1: nieuw portret (tekst-naar-plaatje, geen referentie) ===");
  const requiredAttrs = requiredCharacterAttributes(appearance);
  console.log("Verplichte kenmerken:", requiredAttrs);
  const portrait = await generatePortrait(appearance, "het avontuur begint net", styleHint, null);
  if (!portrait.url) {
    console.error("FOUT: portret genereren is volledig mislukt (geen URL terug).");
    process.exit(1);
  }
  const portraitFile = await download(portrait.url, "check-image-consistency-portrait.png");
  console.log("Portret-URL:", portrait.url);
  console.log("Lokaal opgeslagen voor visuele inspectie:", portraitFile);
  console.log("Automatische verificatie tijdens generatie meldde verified =", portrait.verified);

  // Kruiscontrole: verifieer het EINDRESULTAAT nog een keer apart (los van de retry-loop
  // die intern al gebeurd is), zodat dit script ook op zichzelf een harde uitspraak doet.
  const portraitCheck = await verifyImageAttributes(portrait.url, requiredAttrs, "het portret van de held");
  console.log("Onafhankelijke kruiscontrole:", portraitCheck);
  if (!portraitCheck.attributesPresent) {
    console.error(`FOUT: verplichte kenmerken ontbreken op het portret: ${portraitCheck.missing.join(", ")}`);
    failed = true;
  } else {
    console.log("OK: alle verplichte kenmerken (incl. het petje) staan op het portret.");
  }

  console.log("\n=== Stap 2: wereld-referentiebeeld ===");
  const worldRef = await generateWorldReferenceImage(world, styleHint);
  if (!worldRef.url) {
    console.error("FOUT: wereld-referentiebeeld genereren is volledig mislukt.");
    failed = true;
  } else {
    const worldFile = await download(worldRef.url, "check-image-consistency-world.png");
    console.log("Wereld-referentiebeeld-URL:", worldRef.url);
    console.log("Lokaal opgeslagen voor visuele inspectie:", worldFile);
  }

  console.log("\n=== Stap 3: scène met referentie(s) — donkere sterrenhemel + groen steentje ===");
  const scene = await generateSceneImage(
    chapter1ImagePrompt,
    appearance,
    styleHint,
    world,
    [],
    portrait.url,
    worldRef.url,
  );
  if (!scene.url) {
    console.error("FOUT: scène genereren is volledig mislukt.");
    process.exit(1);
  }
  const sceneFile = await download(scene.url, "check-image-consistency-scene.png");
  console.log("Scène-URL:", scene.url);
  console.log("Lokaal opgeslagen voor visuele inspectie:", sceneFile);

  const sceneRequiredAttrs = [...requiredAttrs, world.landmark];
  const sceneCheck = await verifyImageAttributes(scene.url, sceneRequiredAttrs, "de scène-illustratie");
  console.log("Onafhankelijke kruiscontrole:", sceneCheck);
  if (!sceneCheck.attributesPresent) {
    console.error(`FOUT: verplichte kenmerken ontbreken op de scène-illustratie: ${sceneCheck.missing.join(", ")}`);
    failed = true;
  } else {
    console.log("OK: alle verplichte kenmerken staan op de scène-illustratie.");
  }

  console.log("\n=== Stap 4: nevenpersonage-anker + scène met dat nevenpersonage ===");
  // Vaste, lastige fixture voor een nevenpersonage: de "boogieman" uit de Rens-verhalen, die
  // eerder (tekst-only) per plaat compleet van vorm verschoot. Zijn kenmerk — grote,
  // verdrietige glinsterende ogen — moet nu op zowel het anker als de scène-plaat staan.
  const boogieman = {
    name: "De boogieman",
    appearance: {
      freeform: "Een grote schaduwachtige gedaante die schuilt in het donker, met twee grote, verdrietige ogen die zachtjes glinsteren.",
      distinguishingFeature: "grote, verdrietige glinsterende ogen",
    },
    referenceImageUrl: null as string | null,
  };
  const sideRef = await generateSideCharacterReferenceImage(boogieman, styleHint, null);
  if (!sideRef.url) {
    console.error("FOUT: nevenpersonage-referentiebeeld genereren is volledig mislukt.");
    failed = true;
  } else {
    const sideRefFile = await download(sideRef.url, "check-image-consistency-sidechar-ref.png");
    console.log("Nevenpersonage-anker-URL:", sideRef.url);
    console.log("Lokaal opgeslagen voor visuele inspectie:", sideRefFile);
    boogieman.referenceImageUrl = sideRef.url;

    const sideScenePrompt =
      "Rens zweeft in het donkere deel van de sterrenhemel en praat met een grote schaduwachtige gedaante die vlak voor hem hangt. Sterrenstof dwarrelt tussen hen.";
    const sideScene = await generateSceneImage(
      sideScenePrompt,
      appearance,
      styleHint,
      world,
      [boogieman],
      portrait.url,
      worldRef.url,
    );
    if (!sideScene.url) {
      console.error("FOUT: scène-met-nevenpersonage genereren is volledig mislukt.");
      failed = true;
    } else {
      const sideSceneFile = await download(sideScene.url, "check-image-consistency-sidechar-scene.png");
      console.log("Scène-met-nevenpersonage-URL:", sideScene.url);
      console.log("Lokaal opgeslagen voor visuele inspectie:", sideSceneFile);
      const sideCheck = await verifyImageAttributes(
        sideScene.url,
        [boogieman.appearance.distinguishingFeature],
        "de scène met de boogieman",
      );
      console.log("Onafhankelijke kruiscontrole (kenmerk boogieman):", sideCheck);
      if (!sideCheck.attributesPresent) {
        console.error(`FOUT: kenmerk van het nevenpersonage ontbreekt op de scène: ${sideCheck.missing.join(", ")}`);
        failed = true;
      } else {
        console.log("OK: het kenmerk van de boogieman staat op de scène-illustratie.");
      }
    }
  }

  console.log("\n=== Resultaat ===");
  if (failed) {
    console.error("REGRESSIE GEVONDEN — bekijk de gedownloade afbeeldingen hierboven handmatig.");
    process.exit(1);
  }
  console.log("GESLAAGD — alle verplichte kenmerken zijn automatisch bevestigd.");
  console.log("Bekijk de gedownloade afbeeldingen hierboven ook zelf even, de automatische check is een vangnet, geen garantie.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
