// Orkestratie rond de nevenpersonage-ankerbeelden (zie SideCharacter.referenceImageUrl in
// lib/types.ts en generateSideCharacterReferenceImage in lib/image.ts).
//
// WAAROM een aparte module en niet gewoon in de route: beide API-routes (nieuw verhaal én
// een volgende keuze) moeten precies hetzelfde doen — "heeft dit personage al een anker?
// zo niet, maak het één keer aan, respecteer de dag-quota, en val netjes terug op alleen
// tekst als de quota op is". Dat één keer op één plek houden voorkomt dat de twee routes
// stiekem uit elkaar gaan lopen.
//
// De kosten-afweging is bewust: de eerste keer dat een nevenpersonage in beeld komt, kost
// het anker één extra illustratie. Daarna is dat anker gratis herbruikbaar in elke volgende
// scène — precies zoals het held-portret en het wereld-anker ook één keer gemaakt worden.

import "server-only";
import { generateSideCharacterReferenceImage } from "@/lib/image";
import { tryClaimImageQuota, releaseImageQuota } from "@/lib/image-usage";
import type { SideCharacter } from "@/lib/types";

export type EnsureSideCharacterRefsResult = {
  // De volledige registry (bible.sideCharacters) met de nieuw aangemaakte ankers erin
  // verwerkt, klaar om terug op het verhaal op te slaan.
  registry: SideCharacter[];
  // Dezelfde nevenpersonages als meegegeven, maar met hun (net aangemaakte of al bestaande)
  // referenceImageUrl — dit is wat generateSceneImage als referentie meekrijgt.
  sceneCharacters: SideCharacter[];
};

// Zorgt dat elk nevenpersonage dat in DEZE scène te zien is een referentiebeeld heeft.
// Alleen aanroepen wanneer er echt een verse scène-illustratie gemaakt wordt (bij hergebruik
// van het vorige plaatje hoeft er geen anker gemaakt te worden — dat zou quota verspillen).
//
// Bij uitgeputte quota: die ene ankeraanmaak wordt overgeslagen (het personage blijft
// tekst-only voor nu, geen crash, geen blokkade) en de volgende keer proberen we het weer.
export async function ensureSceneCharacterReferences(
  childId: string,
  registry: SideCharacter[],
  sceneCharacters: SideCharacter[],
  styleHint: string | undefined,
): Promise<EnsureSideCharacterRefsResult> {
  // Kopie van de registry, geïndexeerd op (kleine-letter) naam, zodat we een nieuw anker
  // meteen op de juiste registry-entry kunnen terugschrijven.
  const byName = new Map<string, SideCharacter>();
  for (const c of registry) byName.set(c.name.toLowerCase(), { ...c });

  const resolvedScene: SideCharacter[] = [];
  // Personages die nog een anker missen: we claimen eerst SEQUENTIEEL de dag-quota (dat is een
  // kleine, race-gevoelige file-operatie — parallel zouden twee claims dezelfde vrije plek
  // kunnen pakken), en genereren daarna het TRAGE deel (de fal.ai-beelden) wél PARALLEL. Dat
  // is de grote versnelling: verschijnen er drie nevenpersonages, dan worden hun ankers nu
  // tegelijk gemaakt in plaats van drie keer na elkaar te wachten.
  const toGenerate: SideCharacter[] = [];

  for (const sceneChar of sceneCharacters) {
    const key = sceneChar.name.toLowerCase();
    const known = byName.get(key) ?? { ...sceneChar };
    byName.set(key, known);
    resolvedScene.push(known); // zelfde object-referentie: een straks toegevoegd anker telt hier ook

    // Al een anker? Dan niets doen — gewoon hergebruiken.
    if (known.referenceImageUrl) continue;

    // Nog geen anker: quota claimen (mislukt dat, dan blijft dit personage voorlopig tekst-only).
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
        // Generatie mislukt: quota teruggeven en dit personage voorlopig tekst-only laten.
        await releaseImageQuota(childId);
      }
    }),
  );

  return { registry: Array.from(byName.values()), sceneCharacters: resolvedScene };
}
