import type { Chapter, SideCharacter } from "@/lib/types";
import { characterNamesMatch } from "@/lib/character-identity";

// Alleen figuren die in HET LAATSTE hoofdstuk voor het eerst opduiken, mogen een
// "opslaan"-knop krijgen. De held nooit. Figuren die al eerder meededen, of al in
// de bibliotheek staan, ook niet.
export function newlyIntroducedSideCharacters(
  chapters: Pick<Chapter, "sceneCharacterNames">[],
  sideCharacters: SideCharacter[],
  alreadySavedNames: Set<string>,
  heroName?: string,
): SideCharacter[] {
  if (chapters.length === 0) return [];

  const previous = new Set<string>();
  for (const chapter of chapters.slice(0, -1)) {
    for (const name of chapter.sceneCharacterNames ?? []) {
      const key = name.trim().toLowerCase();
      if (key) previous.add(key);
    }
  }

  const latest = chapters[chapters.length - 1];
  const latestSet = new Set(
    (latest.sceneCharacterNames ?? [])
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const heroKey = heroName?.trim().toLowerCase() ?? "";

  return sideCharacters.filter((character) => {
    if (character.dismissed) return false;
    const name = character.name.trim();
    if (!name || (heroKey && characterNamesMatch(name, heroName ?? ""))) return false;
    if ([...alreadySavedNames].some((saved) => characterNamesMatch(saved, name))) return false;
    if ([...previous].some((seen) => characterNamesMatch(seen, name))) return false;
    if (latestSet.size === 0) return false;
    return [...latestSet].some((seen) => characterNamesMatch(seen, name));
  });
}
