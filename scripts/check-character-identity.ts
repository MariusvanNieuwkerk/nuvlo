// Meet of hetzelfde personage over drie verschillende acties herkenbaar blijft.
// De score wordt alleen opgeschreven. Er wordt niet extra getekend als de score laag is.
//
// Eerst de blinde pagina met je kind bekijken. Daarna pas de AI-pagina.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/check-character-identity.ts
//
// Kost echte teken- en controle-aanroepen. Geen namen van echte kinderen: dit is een
// vast testfiguur.

import fs from "node:fs/promises";
import path from "node:path";
import { buildSceneIdentitySlots } from "@/lib/ai/identity-report";
import type { SceneIdentityReport } from "@/lib/ai/identity-report";

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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function verdictLabel(value: string | boolean | null | undefined): string {
  if (value === "passed" || value === true) return "ja";
  if (value === "failed" || value === false) return "nee";
  if (value === "unknown") return "weet niet";
  return "—";
}

type Drawn = {
  title: string;
  action: string;
  file: string;
  durationMs: number;
  attempts: number;
  attributeVerified: boolean;
  report: SceneIdentityReport | null;
};

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download mislukt (${res.status})`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

function questions(action: string, hasSide: boolean): string {
  const side = hasSide
    ? "<li>Is de bijfiguur hetzelfde figuur als zijn paspoort? ja / nee / weet niet</li>"
    : "";
  return `<ol>
    <li>Is de held hetzelfde figuur als het paspoort? ja / nee / weet niet</li>
    <li>Kloppen gezicht, haar, lijf en kleding nog, ook als de houding anders is? ja / nee / weet niet</li>
    ${side}
    <li>Voelt de tekening als dezelfde tekenstijl? ja / nee / weet niet</li>
    <li>Zie je deze actie: ${escapeHtml(action)}? ja / nee / weet niet</li>
  </ol>`;
}

async function main() {
  await loadEnvLocal();
  const { currentImageModels, generatePortrait, generateSceneImage, generateSideCharacterReferenceImage } =
    await import("@/lib/image");
  const { observeSceneIdentity } = await import("@/lib/ai/vision-verify");

  const outDir = path.join(process.cwd(), "output", "identity-check");
  await fs.mkdir(outDir, { recursive: true });

  const styleHint = "flat colorful 2D children's picture-book illustration, soft colored pencil, warm light, consistent line weight";
  const appearance = {
    freeform: "Een jongen met kort donker haar, een rode pet, een blauwe jas, een gele sjaal, een bruine broek en groene schoenen.",
    hair: "kort donker haar",
    outfit: "blauwe jas, gele sjaal, bruine broek en groene schoenen",
    accessories: ["een rode pet"],
    companion: "",
    skinOrFurTone: "",
    distinguishingFeature: "een rode pet en een gele sjaal",
  };
  const world = {
    freeform: "Een rustig park met een grote boom, een houten bank en zacht groen gras.",
    setting: "een park",
    paletteAndAtmosphere: "zacht groen en warm licht",
    landmark: "een grote boom",
  };
  const side = {
    name: "Wiebel",
    appearance: {
      freeform: "Een kleine ronde groene robot met één gele antenne, twee ronde ogen en korte grijze armpjes.",
      distinguishingFeature: "één gele antenne",
    },
    referenceImageUrl: null as string | null,
  };
  const scenes = [
    { title: "Scène 1", action: "De jongen staat rechtop en zwaait met beide handen. De kleine robot zwaait mee." },
    { title: "Scène 2", action: "De jongen klimt in de grote boom. De kleine robot kijkt van onderen omhoog." },
    { title: "Scène 3", action: "De jongen zit op de houten bank en leest een boek. De kleine robot zit naast hem." },
  ];
  const models = currentImageModels();
  const drawn: Drawn[] = [];

  console.log("Paspoort van de held tekenen…");
  const portraitStarted = Date.now();
  const portrait = await generatePortrait(appearance, "het avontuur begint net", styleHint, null);
  const portraitDurationMs = Date.now() - portraitStarted;
  if (!portrait.url) {
    console.error("Het paspoort van de held lukte niet. Stop.");
    process.exit(1);
  }
  await download(portrait.url, path.join(outDir, "paspoort-held.png"));
  console.log(`Held-paspoort klaar in ${portraitDurationMs} ms, pogingen: ${portrait.attempts}, kenmerken ok: ${portrait.verified}`);

  console.log("Paspoort van de bijfiguur tekenen…");
  const sideStarted = Date.now();
  const sideRef = await generateSideCharacterReferenceImage(side, styleHint, null);
  const sideDurationMs = Date.now() - sideStarted;
  if (!sideRef.url) {
    console.error("Het paspoort van de bijfiguur lukte niet. Stop.");
    process.exit(1);
  }
  side.referenceImageUrl = sideRef.url;
  await download(sideRef.url, path.join(outDir, "paspoort-bijfiguur.png"));
  console.log(`Bijfiguur-paspoort klaar in ${sideDurationMs} ms, pogingen: ${sideRef.attempts}, kenmerken ok: ${sideRef.verified}`);

  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    console.log(`${scene.title} tekenen…`);
    const started = Date.now();
    const image = await generateSceneImage(
      scene.action,
      appearance,
      styleHint,
      world,
      [side],
      portrait.url,
      null,
      null,
      null,
      "Testheld",
    );
    const durationMs = Date.now() - started;
    if (!image.url) {
      console.error(`${scene.title} lukte niet.`);
      drawn.push({
        title: scene.title,
        action: scene.action,
        file: "",
        durationMs,
        attempts: image.attempts,
        attributeVerified: image.verified,
        report: null,
      });
      continue;
    }
    const file = `scene-${index + 1}.png`;
    await download(image.url, path.join(outDir, file));
    const report = await observeSceneIdentity({
      sceneUrl: image.url,
      action: scene.action,
      styleHint,
      slots: buildSceneIdentitySlots({
        heroPassportUrl: portrait.url,
        compareHero: true,
        sidePassportUrls: [side.referenceImageUrl],
      }),
    });
    drawn.push({
      title: scene.title,
      action: scene.action,
      file,
      durationMs,
      attempts: image.attempts,
      attributeVerified: image.verified,
      report,
    });
    console.log(
      `${scene.title}: tekenen ${durationMs} ms, pogingen ${image.attempts}, identiteit ${report.status}, actie ${String(report.actionShown)}, stijl ${String(report.styleMatches)}`,
    );
  }

  const blindCards = drawn
    .filter((scene) => scene.file)
    .map(
      (scene) => `<section>
        <h2>${escapeHtml(scene.title)}</h2>
        <img src="${escapeHtml(scene.file)}" alt="">
        ${questions(scene.action, true)}
      </section>`,
    )
    .join("\n");

  const blindHtml = `<!doctype html>
<html lang="nl">
<meta charset="utf-8">
<title>Blinde kijk — zelfde personages?</title>
<style>
  body { font-family: Georgia, serif; background: #f7f2e8; color: #243028; margin: 0 auto; max-width: 720px; padding: 32px 20px 80px; }
  img { width: 100%; border-radius: 16px; }
  .pass { display: flex; gap: 12px; }
  .pass figure { flex: 1; margin: 0; }
  .pass img { height: 220px; object-fit: contain; background: #fffaf3; }
  section { margin-top: 40px; }
  h1, h2 { font-weight: 500; }
</style>
<body>
  <h1>Zijn dit dezelfde figuren?</h1>
  <p>Kijk eerst alleen naar deze pagina. Zet de andere pagina nog niet open. Een andere houding of blik mag. Het gaat erom of je ze nog herkent.</p>
  <div class="pass">
    <figure><img src="paspoort-held.png" alt=""><figcaption>Paspoort held</figcaption></figure>
    <figure><img src="paspoort-bijfiguur.png" alt=""><figcaption>Paspoort bijfiguur</figcaption></figure>
  </div>
  ${blindCards}
</body>
</html>`;

  const aiCards = drawn
    .map((scene) => {
      const rows = (scene.report?.characters ?? [])
        .map(
          (character) => `<tr>
            <td>${escapeHtml(character.slot)}</td>
            <td>${verdictLabel(character.verdict)}</td>
            <td>${verdictLabel(character.face)}</td>
            <td>${verdictLabel(character.hair)}</td>
            <td>${verdictLabel(character.body)}</td>
            <td>${verdictLabel(character.clothes)}</td>
            <td>${verdictLabel(character.style)}</td>
            <td></td>
          </tr>`,
        )
        .join("");
      const picture = scene.file ? `<img src="${escapeHtml(scene.file)}" alt="">` : "<p>Geen tekening.</p>";
      return `<section>
        <h2>${escapeHtml(scene.title)}</h2>
        ${picture}
        <p>Actie gevraagd: ${escapeHtml(scene.action)}</p>
        <p>Tekenen: ${scene.durationMs} ms · pogingen: ${scene.attempts} · kenmerken-check: ${scene.attributeVerified ? "ja" : "nee"}</p>
        <p>AI identiteit: ${verdictLabel(scene.report?.status)} · AI actie: ${verdictLabel(scene.report?.actionShown)} · AI stijl: ${verdictLabel(scene.report?.styleMatches)} · controle: ${scene.report?.durationMs ?? "—"} ms</p>
        <table>
          <tr><th>Figuur</th><th>Zelfde?</th><th>Gezicht</th><th>Haar</th><th>Lijf</th><th>Kleding</th><th>Stijl</th><th>Kind</th></tr>
          ${rows}
        </table>
        <p>Kind over de actie: ja / nee / weet niet</p>
      </section>`;
    })
    .join("\n");

  const aiHtml = `<!doctype html>
<html lang="nl">
<meta charset="utf-8">
<title>AI-scores — pas daarna openen</title>
<style>
  body { font-family: Georgia, serif; background: #f7f2e8; color: #243028; margin: 0 auto; max-width: 800px; padding: 32px 20px 80px; }
  img { width: 100%; border-radius: 16px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border-bottom: 1px solid #e4d8c8; text-align: left; padding: 6px; font-size: 14px; }
</style>
<body>
  <h1>AI-scores</h1>
  <p>Open dit pas nadat de blinde pagina is ingevuld. De kolom “Kind” is voor jullie antwoord. Kosten in euro’s zijn niet berekend. Wel: model, tijd, pogingen en tokens.</p>
  <p>Tekenmodel: ${escapeHtml(models.textToImage)} · bewerkmodel: ${escapeHtml(models.edit)} · controlemiddel: ${escapeHtml(drawn.find((scene) => scene.report)?.report?.model || "claude-haiku-4-5")}</p>
  ${aiCards}
</body>
</html>`;

  await fs.writeFile(path.join(outDir, "blind.html"), blindHtml);
  await fs.writeFile(path.join(outDir, "ai.html"), aiHtml);
  await fs.writeFile(
    path.join(outDir, "result.json"),
    JSON.stringify(
      {
        models,
        note: "Geen euro-schatting. Tokens staan per controle. Deze score heeft geen nieuwe tekening gestart.",
        portraits: {
          hero: { attempts: portrait.attempts, attributeVerified: portrait.verified, durationMs: portraitDurationMs },
          side: { attempts: sideRef.attempts, attributeVerified: sideRef.verified, durationMs: sideDurationMs },
        },
        scenes: drawn,
      },
      null,
      2,
    ),
  );

  console.log("\nKlaar. Eerst openen:");
  console.log(path.join(outDir, "blind.html"));
  console.log("Pas daarna:");
  console.log(path.join(outDir, "ai.html"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
