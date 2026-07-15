// Handmatig een vastgelopen hoofdstuk-illustratie opnieuw proberen, MET volledige
// foutmeldingen in de terminal (in tegenstelling tot de API-route, die fouten alleen
// naar de (voor ons onzichtbare) Vercel-serverlogs schrijft). Handig bij een hoofdstuk dat
// voor altijd op imagePending=true is blijven staan.
//
// UITVOEREN:
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/retry-chapter-image.ts <storyId> <chapterN>
//
// Vereist geldige SUPABASE_*/FAL_KEY/ANTHROPIC_KEY in .env.local. Roept dezelfde functies aan
// als app/api/stories/[id]/chapters/[n]/image/route.ts, maar dan lokaal — dus met dezelfde
// dag-quota (telt dus WEL mee als een echte poging).
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
  const [storyId, chapterNRaw] = process.argv.slice(2);
  const chapterN = Number(chapterNRaw);
  if (!storyId || !Number.isInteger(chapterN)) {
    console.error("Gebruik: npx tsx scripts/retry-chapter-image.ts <storyId> <chapterN>");
    process.exit(1);
  }

  await loadEnvLocal();

  const { getStory, getDefaultChild, updateChapterImageAtomic } = await import("@/lib/storage");
  const { generateSceneImage } = await import("@/lib/image");
  const { tryClaimImageQuota, releaseImageQuota } = await import("@/lib/image-usage");
  const { ensureSceneCharacterReferences } = await import("@/lib/side-character-images");

  const story = await getStory(storyId);
  if (!story) throw new Error("Verhaal niet gevonden.");
  const chapter = story.chapters.find((c) => c.n === chapterN);
  if (!chapter) throw new Error(`Hoofdstuk ${chapterN} niet gevonden.`);

  console.log(`Hoofdstuk ${chapterN}: imagePending=${chapter.imagePending}, imageUrl=${chapter.imageUrl}, imageReused=${chapter.imageReused}`);

  const child = await getDefaultChild();
  const bible = story.bible;
  const character = story.character;
  const sceneCharactersInScene = bible.sideCharacters.filter((c) =>
    (chapter.sceneCharacterNames ?? []).some((name) => name.toLowerCase() === c.name.toLowerCase()),
  );

  let sceneImageUrl: string | null = chapter.imageUrl;
  let updatedBible = bible;

  if (!chapter.imageReused) {
    console.log("Referentiebeelden voor nevenpersonages in deze scène ophalen/aanmaken...");
    const refs = await ensureSceneCharacterReferences(
      child.id,
      bible.sideCharacters,
      sceneCharactersInScene,
      character.imageStyleHint,
    );
    updatedBible = { ...bible, sideCharacters: refs.registry };

    console.log("Dagquota claimen...");
    const claimed = await tryClaimImageQuota(child.id);
    console.log("Quota geclaimd:", claimed);
    if (claimed) {
      console.log("fal.ai-aanroep starten (dit kan 10-40s duren)...");
      const scene = await generateSceneImage(
        chapter.imagePrompt,
        character.appearance,
        character.imageStyleHint,
        bible.worldAppearance,
        refs.sceneCharacters,
        character.portraitUrl,
        null,
        chapter.heroTemporaryAppearance,
      );
      console.log("Resultaat:", scene);
      if (scene.url) {
        sceneImageUrl = scene.url;
      } else {
        await releaseImageQuota(child.id);
      }
    }
  }

  console.log("Wegschrijven...");
  const updated = await updateChapterImageAtomic(storyId, chapterN, sceneImageUrl, updatedBible);
  const updatedChapter = updated?.chapters.find((c) => c.n === chapterN);
  console.log("Klaar. Nieuwe staat:", {
    imagePending: updatedChapter?.imagePending,
    imageUrl: updatedChapter?.imageUrl,
  });
}

main().catch((err) => {
  console.error("FOUT:", err);
  process.exit(1);
});
