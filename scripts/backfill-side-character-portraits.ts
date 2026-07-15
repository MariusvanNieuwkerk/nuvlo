// Eenmalig reparatiescript: bijfiguren die vóór de "gegarandeerd een eigen plaatje"-fix zijn
// opgeslagen (bv. omdat ze nooit in een geïllustreerde scène voorkwamen) hebben nog steeds
// portrait_url = null in de characters-tabel, en niets triggert daar normaal nog een generatie
// voor — dit script haalt ze op en genereert alsnog een ankerbeeld per stuk.
//
// UITVOEREN (zelfde react-server-truc als scripts/check-image-consistency.ts, nodig vanwege de
// "server-only"-marker in lib/image.ts en lib/storage.ts):
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/backfill-side-character-portraits.ts
//
// Vereist geldige SUPABASE_*/FAL_KEY in .env.local. Roept lib/image.ts direct aan (niet via de
// API-routes), dus dit telt NIET mee voor de dagelijkse kind-quota.
import fs from "node:fs/promises";
import path from "node:path";

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

async function main() {
  await loadEnvLocal();

  const { listCharacters, saveCharacter } = await import("@/lib/storage");
  const { generateSideCharacterReferenceImage } = await import("@/lib/image");

  const characters = await listCharacters();
  const targets = characters.filter((c) => c.kind === "side" && !c.portraitUrl);

  if (targets.length === 0) {
    console.log("Geen bijfiguren zonder portret gevonden — niets te doen.");
    return;
  }

  console.log(`${targets.length} bijfiguur/bijfiguren zonder portret gevonden:`, targets.map((c) => c.name));

  for (const character of targets) {
    console.log(`\n→ Genereer ankerbeeld voor "${character.name}"…`);
    const ref = await generateSideCharacterReferenceImage(
      {
        name: character.name,
        appearance: {
          freeform: character.appearance.freeform,
          distinguishingFeature: character.appearance.distinguishingFeature,
        },
        referenceImageUrl: null,
      },
      character.imageStyleHint,
      null,
    );
    if (!ref.url) {
      console.error(`  FOUT: genereren mislukt voor "${character.name}" — overgeslagen.`);
      continue;
    }
    await saveCharacter({ ...character, id: character.id, portraitUrl: ref.url });
    console.log(`  OK: "${character.name}" heeft nu een portret → ${ref.url}`);
  }

  console.log("\nKlaar.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
