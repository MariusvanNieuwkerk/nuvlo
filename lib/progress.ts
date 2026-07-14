// Kindvriendelijke voortgang van een boek. Dit is BEWUST een los, framework-neutraal bestand
// (geen "server-only", geen imports uit de beeld-/AI-laag), zodat zowel server-componenten als
// client-componenten (de lees-UI, de boekenplank-kaart) dezelfde berekening delen — één bron
// van waarheid, geen twee definities die uit elkaar kunnen lopen.
//
// GEHEIM blijft geheim: hier zit NIETS over de 5-akte-structuur uit de StoryBible in. Het kind
// ziet alleen "hoe ver ben ik in mijn boek", nooit akte-namen of verhaalregie-meta.

// Richtgetal: een boek rondt ongeveer na dit aantal hoofdstukken af. story-director.ts hangt
// zijn eigen pacing/finale-logica hieraan op (zie CHAPTERS_TOTAL daar), dus dit getal is de
// gedeelde bron.
export const CHAPTERS_TARGET = 14;

export type ReadingProgress = {
  chaptersDone: number; // aantal hoofdstukken tot nu toe
  target: number; // richtgetal waar het boek ongeveer op afrondt
  fraction: number; // 0..1, hoe vol de "boekrug" staat
  finished: boolean;
  // Korte, warme, kindvriendelijke omschrijving — nooit een akte-naam of gamified XP-taal.
  label: string;
};

// Zolang een boek nog niet echt af is, laten we de balk NOOIT helemaal vollopen — anders zou
// een kind bij hoofdstuk 14 "100%" zien terwijl de finale nog moet komen. De trofee/"af" is
// gereserveerd voor het echte einde (status "klaar").
const MAX_FRACTION_WHILE_READING = 0.92;

export function computeProgress(chaptersDone: number, finished: boolean): ReadingProgress {
  const target = CHAPTERS_TARGET;
  if (finished) {
    return { chaptersDone, target, fraction: 1, finished: true, label: "Boek af!" };
  }
  const raw = target > 0 ? chaptersDone / target : 0;
  const fraction = Math.max(0.04, Math.min(raw, MAX_FRACTION_WHILE_READING));

  let label: string;
  if (raw >= 0.85) label = "Bijna af!";
  else if (raw >= 0.55) label = "Al een heel eind";
  else if (raw >= 0.25) label = "Lekker op weg";
  else label = "Net begonnen";

  return { chaptersDone, target, fraction, finished: false, label };
}
