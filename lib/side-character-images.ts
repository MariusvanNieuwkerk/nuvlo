// Orkestratie rond de nevenpersonage-ankerbeelden (zie SideCharacter.referenceImageUrl in
// lib/types.ts en generateSideCharacterReferenceImage in lib/image.ts).
//
// WAAROM een aparte module en niet gewoon in de route: beide API-routes (nieuw verhaal én
// een volgende keuze) moeten precies hetzelfde doen — "heeft dit personage al een anker?
// zo niet, maak het één keer aan, respecteer de dag-quota, en val netjes terug op alleen
// tekst als de quota op is". Dat één keer op één plek houden voorkomt dat de twee routes
// stiekem uit elkaar gaan lopen.
//
// Identiteit komt ALLEEN uit de vaste zin + het paspoort. Een vorige scène is geen
// voorbeeld: daar kan het model een verkeerd wezen hebben getekend.

import "server-only";
import { generateSideCharacterReferenceImage } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";
import { findByCharacterName } from "@/lib/character-identity";
import type { SideCharacter } from "@/lib/types";

export type EnsureSideCharacterRefsResult = {
  // De volledige registry (bible.sideCharacters) met de nieuw aangemaakte ankers erin
  // verwerkt, klaar om terug op het verhaal op te slaan.
  registry: SideCharacter[];
  // Dezelfde nevenpersonages als meegegeven, maar met hun (net aangemaakte of al bestaande)
  // referenceImageUrl — dit is wat generateSceneImage als referentie meekrijgt.
  sceneCharacters: SideCharacter[];
};

export async function ensureSceneCharacterReferences(
  childId: string,
  registry: SideCharacter[],
  sceneCharacters: SideCharacter[],
  styleHint: string | undefined,
): Promise<EnsureSideCharacterRefsResult> {
  const copies: SideCharacter[] = registry.map((character) => ({ ...character }));
  const resolvedScene: SideCharacter[] = [];
  const toGenerate: SideCharacter[] = [];

  for (const sceneChar of sceneCharacters) {
    const known = findByCharacterName(copies, sceneChar.name) ?? { ...sceneChar };
    if (!findByCharacterName(copies, known.name)) copies.push(known);
    resolvedScene.push(known);

    if (known.referenceImageUrl) continue;
    if (await tryClaimImageQuota(childId)) {
      toGenerate.push(known);
    }
  }

  await Promise.all(
    toGenerate.map(async (known) => {
      const ref = await generateSideCharacterReferenceImage(known, styleHint, null);
      if (ref.url) {
        known.referenceImageUrl = ref.url;
      } else {
        await releaseImageQuota(childId);
      }
    }),
  );

  return { registry: copies, sceneCharacters: resolvedScene };
}
