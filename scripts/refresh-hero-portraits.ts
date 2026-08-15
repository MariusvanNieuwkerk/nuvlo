// Vernieuwt held-portretten naar een vierkant buste-beeld (hoofd + schouders + borst)
// dat wél in de ronde avatars past. Oude landschap-portretten maakten de cirkels leeg.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/refresh-hero-portraits.ts
//
// Telt NIET mee voor de dagelijkse kind-quota (roept lib/image.ts direct aan).
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
    // env al gezet
  }
}

async function main() {
  await loadEnvLocal();

  const { generatePortrait } = await import("@/lib/image");
  const { listCharacters, saveCharacter, listStories, saveStory } = await import("@/lib/storage");

  const heroes = (await listCharacters()).filter((c) => c.kind === "hero");
  if (heroes.length === 0) {
    console.error("Geen opgeslagen helden gevonden.");
    process.exit(1);
  }

  const stories = await listStories();
  const oldToNew = new Map<string, string>();

  for (const hero of heroes) {
    console.log(`\n→ ${hero.name}`);
    if (!hero.portraitUrl) {
      console.log("  geen oud portret, overslaan");
      continue;
    }

    const result = await generatePortrait(
      hero.appearance,
      "het avontuur begint net",
      hero.imageStyleHint,
      hero.portraitUrl,
    );
    if (!result.url) {
      console.error("  FOUT: nieuw portret mislukt, oude blijft staan");
      continue;
    }

    oldToNew.set(hero.portraitUrl, result.url);
    await saveCharacter({
      id: hero.id,
      childId: hero.childId,
      name: hero.name,
      kind: hero.kind,
      appearance: hero.appearance,
      imageStyleHint: hero.imageStyleHint,
      portraitUrl: result.url,
      sourceStoryIds: hero.sourceStoryIds,
      seriesNote: hero.seriesNote,
      notes: hero.notes,
    });
    console.log("  bibliotheek bijgewerkt");
    console.log(" ", result.url);
  }

  // Papa (en andere story-only helden) hebben geen bibliotheek-rij — hun anker
  // zit alleen op het boek. Vernieuw die ook als we die naam nog niet deden.
  const storyOnlyNames = new Set(
    stories
      .map((s) => s.hero.name.trim().toLowerCase())
      .filter((n) => !heroes.some((h) => h.name.trim().toLowerCase() === n)),
  );

  for (const story of stories) {
    const key = story.hero.name.trim().toLowerCase();
    if (!storyOnlyNames.has(key)) continue;
    storyOnlyNames.delete(key);
    const old = story.character.portraitUrl;
    if (!old) continue;
    console.log(`\n→ ${story.hero.name} (alleen in boek)`);
    const result = await generatePortrait(
      story.character.appearance,
      "het avontuur begint net",
      story.character.imageStyleHint,
      old,
    );
    if (!result.url) {
      console.error("  FOUT: nieuw portret mislukt");
      continue;
    }
    oldToNew.set(old, result.url);
    console.log(" ", result.url);
  }

  let updatedStories = 0;
  for (const story of stories) {
    const old = story.character.portraitUrl;
    const next = old ? oldToNew.get(old) : undefined;
    if (!next || next === old) continue;
    story.character.portraitUrl = next;
    await saveStory(story);
    updatedStories += 1;
    console.log(`  boek bijgewerkt: ${story.title}`);
  }

  console.log(`\nKlaar. ${oldToNew.size} nieuwe portretten, ${updatedStories} boeken bijgewerkt.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
