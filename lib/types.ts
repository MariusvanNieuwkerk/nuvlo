// Datamodel voor Nuvlo. Fase 1: alles lokaal opgeslagen (zie lib/storage.ts).
// Dit bestand verandert niet wanneer we later naar Supabase overstappen — alleen de
// opslaglaag verandert, de types blijven hetzelfde.
//
// Uiterlijken (character, wereld, nevenpersonages) zijn GESTRUCTUREERD (zie
// lib/appearance.ts) in plaats van vrije tekst — dat is een bewuste architectuurkeuze:
// vrije tekst is verliesgevoelig (zie lib/appearance.ts voor de volledige uitleg), losse
// velden zijn dat niet.

import type { CharacterAppearance, SideCharacterAppearance, WorldAppearance } from "@/lib/appearance";

export type Genre =
  | "avontuur"
  | "fantasie"
  | "ruimte"
  | "onderwater"
  | "dieren"
  | "detective";

export type Child = {
  id: string;
  name: string;
  age: number; // stuurt het leesniveau (AVI-achtig)
};

export type Hero = {
  name: string;
  world: string;
  power: string;
  weakness: string;
  enemy: string;
  genre: Genre;
};

export type CharacterSheet = {
  appearance: CharacterAppearance; // gestructureerd — verborgen, gaat mee in elke image-prompt
  imageStyleHint: string; // Engelse kunststijl-aanwijzing voor de illustratie-AI, bv. "Minecraft voxel art style"
  items: string[]; // ge-unlockte accessoires/skins
  portraitUrl: string | null; // held-portret dat het kind nu ziet (uitgestelde beloning)
  pendingPortraitUrl: string | null; // nieuw portret, wacht tot de volgende sessie om te tonen
  // Nice-to-have vlag: het laatste portret voldeed na alle verificatie-pogingen nog niet
  // aan de harde uiterlijk-eisen. We blokkeren het verhaal daar nooit voor (beste poging
  // wordt gewoon getoond), maar deze vlag maakt het server-side debugbaar in plaats van
  // pas weken later via een klacht te ontdekken.
  portraitVerificationFailed?: boolean;
  // True zodra een uitgesteld portret op een nieuwe sessie zichtbaar is geworden
  // (pendingPortraitUrl → portraitUrl, zie revealDuePortrait in lib/storage.ts) maar het kind
  // dat "veranderd sinds gisteren"-moment nog niet gezien heeft. De lees-/verhaalpagina toont
  // het één keer en zet de vlag dan terug op false (zie de portrait-seen route) — zo voelt de
  // uitgestelde beloning echt, zonder te blijven zeuren. Ontbrekend veld = niets te tonen.
  hasUnseenPortrait?: boolean;
};

// Een terugkerend nevenpersonage (bv. een pratend huisdier, een robot-hulpje) met een
// vast uiterlijk, zodat het er in elke illustratie waarin het voorkomt hetzelfde uitziet.
export type SideCharacter = {
  name: string;
  appearance: SideCharacterAppearance;
  // Eén vast referentiebeeld van dit nevenpersonage, precies zoals de held een
  // portretUrl heeft en de wereld een worldReferenceImageUrl — dat is het ENIGE dat
  // consistentie tussen platen echt afdwingt (louter tekst bleek verliesgevoelig: dezelfde
  // "boogieman" werd de ene keer een reus, de andere keer een wolkje). Wordt lui aangemaakt
  // de eerste keer dat dit personage in een scène verschijnt (zie lib/side-character-images.ts).
  // null zolang dat nog niet gebeurd is (en voor oudere verhalen zonder dit veld).
  referenceImageUrl: string | null;
  // De ouder/het kind heeft dit nevenpersonage weggedrukt uit de "Sla op als personage"-
  // suggestielijst. Dit verbergt ALLEEN die suggestie — het personage blijft gewoon in het
  // verhaal en in de illustraties (die gebruiken de volledige sideCharacters-lijst). Optioneel/
  // afwezig = niet weggedrukt (ook zo voor oudere verhalen zonder dit veld).
  dismissed?: boolean;
};

// GEHEIM: nooit tonen aan het kind.
export type StoryBible = {
  aktes: string[]; // 5 aktes, heldenreis
  openThreads: string[];
  worldAppearance: WorldAppearance; // vaste visuele spec van de wereld/omgeving, voor elke illustratie
  // Eén vast referentiebeeld van de wereld zelf (naast het held-portret), gebruikt als
  // extra beeld-anker bij elke scène — zie lib/image.ts. Voorheen werd de omgeving ALLEEN
  // in tekst herhaald, en dat bleek niet genoeg om ze er ook echt hetzelfde uit te laten
  // zien. null zolang dit nog niet gegenereerd is (of voor oudere verhalen).
  worldReferenceImageUrl: string | null;
  sideCharacters: SideCharacter[]; // bekende nevenpersonages met hun vaste uiterlijk
};

export type Chapter = {
  n: number;
  // De leestekst van het hoofdstuk, opgesplitst in ~3 leesbladzijden (één verhaalbeat per
  // bladzijde). Lezen is de kern van de app, dus een hoofdstuk is bewust MEER tekst dan één
  // kort blokje: het kind bladert eerst een paar bladzijden door voordat het een keuze maakt.
  // De laatste bladzijde eindigt op de cliffhanger, vlak vóór de keuzes.
  pages: string[];
  // DEPRECATED: oudere verhalen (data/stories.json van vóór de meerdere-bladzijden-functie)
  // hadden één `text`-veld i.p.v. `pages`. Blijft optioneel bestaan zodat oude data niet
  // crasht; lib/storage.ts (normalizeChapter) zet een oud `text` bij het inlezen om naar
  // `pages: [text]`, zodat oude, afgemaakte verhalen leesbaar blijven.
  text?: string;
  choices: string[]; // leeg bij finale
  chosen: string | null;
  imagePrompt: string;
  imageUrl: string | null;
  // True zolang de illustratie van dit hoofdstuk nog op de ACHTERGROND gemaakt wordt. De
  // choice-flow is opgesplitst in twee fases: fase A slaat het hoofdstuk met alleen de tekst
  // op (imageUrl nog null, imagePending true → de tekst is meteen leesbaar), fase B (een apart
  // endpoint, zie app/api/stories/[id]/chapters/[n]/image) maakt daarna het zware beeldwerk en
  // zet imagePending weer op false. Zo verschijnt het plaatje als "beloning" terwijl het kind
  // al leest. Ontbrekend veld (oudere hoofdstukken) = niets meer te doen (beeld staat er al).
  imagePending?: boolean;
  // De namen van de nevenpersonages die Claude aangaf dat écht in DEZE scène te zien zijn —
  // apart bewaard zodat fase B (die los van de choice-request draait) weet welke ankerbeelden
  // als referentie meemoeten in de scène-illustratie. Alleen relevant zolang imagePending true
  // is; daarna puur informatief. Ontbrekend veld = geen nevenpersonages in beeld.
  sceneCharacterNames?: string[];
  // Zie CharacterSheet.portraitVerificationFailed — dezelfde nice-to-have vlag, maar dan
  // voor de scène-illustratie van dit hoofdstuk.
  imageVerificationFailed?: boolean;
  // True als imageUrl HERGEBRUIKT is van het vorige hoofdstuk (de scène was niet visueel
  // anders genoeg om een nieuwe, betaalde fal.ai-aanroep te verdienen — zie
  // shouldGenerateFreshImage in lib/story-director.ts). Ontbrekend veld (oudere
  // hoofdstukken van vóór deze functie) betekent altijd "vers gegenereerd" — dat is de
  // veilige terugval, anders zou de skip-streak-telling oude data verkeerd meerekenen.
  imageReused?: boolean;
  // De naam van het voorwerp dat het kind in DIT hoofdstuk ge-unlockt heeft (mijlpaal-beat,
  // zie isItemUnlockMilestone). De lees-UI toont hier één keer een klein feestmoment ("Nieuw!
  // Je hebt … verdiend"). Ontbrekend/leeg = geen unlock in dit hoofdstuk.
  unlockedItem?: string;
};

export type StoryStatus = "bezig" | "klaar";

export type Story = {
  id: string;
  childId: string;
  title: string;
  // De ECHTE naam (en leeftijd) van het kind dat dit boek liet maken — apart van hero.name
  // (de naam van de FANTASIE-held in het verhaal, bv. "Steve"). Deze twee werden eerder
  // per ongeluk verward: de boekenplank toonde "Auteur: {hero.name}", wat gewoon de
  // heldennaam was, niet het echte kind. Optioneel/null voor oudere boeken van vóór dit
  // veld bestond (die tonen dan een neutrale terugval, zie components/story-card.tsx).
  authorName: string | null;
  authorAge: number | null;
  hero: Hero;
  character: CharacterSheet;
  bible: StoryBible;
  summary: string; // lopende samenvatting van het hele verhaal
  status: StoryStatus;
  chapters: Chapter[];
  coverUrl: string | null; // gegenereerde boek-cover voor de boekenplank
  favorite: boolean; // door het kind "opgeslagen" — komt boven in de boekenplank
  createdAt: string;
  updatedAt: string;
};

export const GENRE_LABELS: Record<Genre, string> = {
  avontuur: "Avontuur",
  fantasie: "Fantasie",
  ruimte: "Ruimte",
  onderwater: "Onderwater",
  dieren: "Dieren",
  detective: "Detective",
};

// ─────────────────────────────────────────────────────────────────────────────
// Personagens-bibliotheek (hoofd- en bijfiguren herbruikbaar over boeken heen)
//
// Een `CharacterSheet` leeft van oudsher alleen BINNEN één `Story` (story.character). Met dit
// type tillen we de WEZENLIJKE vastigheden van een held (uiterlijk + tekenstijl + portret) los
// van één boek, zodat het kind zijn favoriete held opnieuw kan kiezen — of een leuk
// nevenpersonage uit een boek kan oppakken als held voor een nieuw avontuur.
//
// `kind` maakt onderscheid tussen een hoofdfiguur ("hero", zelf op het held-formulier gekozen
// of vanuit een verhaal opgeslagen) en een bijfiguur ("side", ooit als nevenpersonage in een
// boek opgedoken en los bewaard). `sourceStoryIds` is de audit-trail: welke verhalen hebben
// dit personage al gebruikt? zo kan de boekenplank visueel clusteren (dezelfde held →
// "Finn-reeks") en kunnen we later dubbele saves voorkomen. `seriesNote` is een optioneel
// labeltje ("Finn-reeks") voor die clustering — KIS, geen apart Series-entity.
// ─────────────────────────────────────────────────────────────────────────────
export type CharacterKind = "hero" | "side";

export type SavedCharacter = {
  id: string;
  childId: string;
  name: string;
  kind: CharacterKind;
  appearance: CharacterAppearance; // gestructureerd — zelfde vorm als story.character.appearance
  imageStyleHint: string; // Engelse kunststijl-aanwijzing, identiek aan CharacterSheet.imageStyleHint
  portraitUrl: string | null; // herbruikbaar ankerbeeld — scheelt een fal-call per nieuw boek
  sourceStoryIds: string[]; // verhalen die dit personage al gebruikten (audit + reeks-clustering)
  // Optioneel reeks-labeltje (bv. "Finn-reeks") voor visuele clustering op de boekenplank.
  // Geen aparte Series-entity — KIS: dit is puur een string die getoond mag worden.
  seriesNote?: string;
  notes?: string; // vrije ruimte, bv. "opgeslagen vanuit boek X" — niet getoond, wel debugbaar
  createdAt: string;
};
