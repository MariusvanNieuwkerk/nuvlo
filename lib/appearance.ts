// Gestructureerde uiterlijk-specificaties — de kern van de "root cause"-fix voor
// verdwijnende details (zoals een petje dat wél gevraagd maar niet getekend werd).
//
// WAAROM dit een apart bestand is en geen losse vrije-tekst-zin meer:
// Vrije tekst is verliesgevoelig bij ELKE doorgifte. Claude herschrijft "een petje
// achterstevoren op zijn hoofd" de volgende keer misschien net iets anders, en een
// beeldmodel moet zelf raden welke woorden in één lange zin het belangrijkst zijn — een
// concreet accessoire verdrinkt dan makkelijk tussen sfeerwoorden. Door elk visueel
// kenmerk in een EIGEN veld te zetten (haar, kleding, accessoires als losse lijst-items,
// het meest kenmerkende detail apart), kan de prompt-opbouw in lib/image.ts elk kenmerk
// apart en verplicht opsommen, en kan lib/ai/vision-verify.ts na het genereren exact
// diezelfde lijst controleren. Niets kan dan nog stilletjes "tussen de regels" verdwijnen.
//
// Oudere verhalen in data/stories.json hebben deze velden nog niet (daar was `appearance`
// gewoon een string). De clean*-functies hieronder migreren zo'n oude string automatisch
// naar deze structuur (als `freeform`, met lege losse velden) zodra het verhaal geladen
// wordt — zie lib/storage.ts. Er is dus geen aparte migratiestap nodig, en oude data kan
// de app nooit laten crashen.

export type CharacterAppearance = {
  freeform: string; // volledige, leesbare zin — voor weergave en als vangnet/basis
  hair: string;
  outfit: string;
  accessories: string[]; // élk accessoire als los item — dit is precies wat eerder wegviel
  companion: string; // vast huisdier/sidekick dat altijd meegetekend wordt, leeg als er geen is
  skinOrFurTone: string;
  distinguishingFeature: string; // het ENE meest kenmerkende detail — wordt overal herhaald als harde eis
};

export type WorldAppearance = {
  freeform: string;
  setting: string; // type omgeving/wereld, bv. "een eindeloze sterrenhemel"
  paletteAndAtmosphere: string; // kleuren en sfeer
  landmark: string; // één opvallend, herkenbaar en tekenbaar element dat overal terugkomt
};

export type SideCharacterAppearance = {
  freeform: string;
  distinguishingFeature: string; // het kenmerk dat dit personage herkenbaar maakt tussen platen
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

// Accepteert zowel de oude vrije-tekst-vorm (string) als de nieuwe gestructureerde vorm
// (mogelijk met ontbrekende velden, bv. van een oudere Claude-aanroep) en geeft altijd een
// volledig, veilig CharacterAppearance-object terug.
export function cleanCharacterAppearance(raw: unknown, fallbackFreeform = ""): CharacterAppearance {
  if (typeof raw === "string") {
    const written = raw.trim() || fallbackFreeform;
    return {
      freeform: written,
      hair: "",
      outfit: "",
      accessories: [],
      companion: "",
      skinOrFurTone: "",
      distinguishingFeature: written,
    };
  }
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const freeform = asTrimmedString(r.freeform) || fallbackFreeform;
  return {
    freeform,
    hair: asTrimmedString(r.hair),
    outfit: asTrimmedString(r.outfit),
    accessories: asStringArray(r.accessories),
    companion: asTrimmedString(r.companion),
    skinOrFurTone: asTrimmedString(r.skinOrFurTone),
    distinguishingFeature: asTrimmedString(r.distinguishingFeature) || freeform,
  };
}

export function cleanWorldAppearance(raw: unknown, fallbackFreeform = ""): WorldAppearance {
  if (typeof raw === "string") {
    return { freeform: raw.trim() || fallbackFreeform, setting: "", paletteAndAtmosphere: "", landmark: "" };
  }
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    freeform: asTrimmedString(r.freeform) || fallbackFreeform,
    setting: asTrimmedString(r.setting),
    paletteAndAtmosphere: asTrimmedString(r.paletteAndAtmosphere),
    landmark: asTrimmedString(r.landmark),
  };
}

export function cleanSideCharacterAppearance(raw: unknown, fallbackFreeform = ""): SideCharacterAppearance {
  if (typeof raw === "string") {
    return { freeform: raw.trim() || fallbackFreeform, distinguishingFeature: "" };
  }
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    freeform: asTrimmedString(r.freeform) || fallbackFreeform,
    distinguishingFeature: asTrimmedString(r.distinguishingFeature),
  };
}

// De harde-eisen-checklist voor beeldverificatie: precies de kenmerken die eerder silent
// wegvielen (accessoires, het belangrijkste kenmerk, een vast gezelschapsdier). Haar/kleur
// checken we niet apart — die worden al goed meegenomen door de referentiefoto zelf, en te
// veel checks maken de verificatie traag/duur zonder veel extra waarde.
export function requiredCharacterAttributes(appearance: CharacterAppearance): string[] {
  const attrs: string[] = [];
  if (appearance.freeform.trim()) attrs.push(appearance.freeform.trim());
  for (const item of appearance.accessories) {
    if (item.trim() && !attrs.includes(item.trim())) attrs.push(item.trim());
  }
  if (appearance.distinguishingFeature && !attrs.includes(appearance.distinguishingFeature)) {
    attrs.push(appearance.distinguishingFeature);
  }
  if (appearance.companion && !attrs.includes(appearance.companion)) {
    attrs.push(appearance.companion);
  }
  return attrs.filter((a) => a.trim().length > 0);
}

// Checklist voor "is dit nog dezelfde figuur?" — haar/kleding van de held plus het
// vaste kenmerk van elk nevenpersonage. Zonder deze lijst slaat verificatie over
// (lege checklist = altijd OK) en kan een robot stilletjes een ander wezen worden.
export function requiredSceneIdentityAttributes(
  appearance: CharacterAppearance,
  sceneCharacters: { name: string; appearance: SideCharacterAppearance }[] = [],
  heroName?: string,
): string[] {
  const hero = heroName?.trim() || "de held";
  const attrs: string[] = [];
  if (appearance.freeform.trim()) {
    attrs.push(`${hero} ziet er precies zo uit: ${appearance.freeform}`);
  }
  if (appearance.hair.trim()) attrs.push(`${hero} heeft dit haar: ${appearance.hair}`);
  if (appearance.outfit.trim()) attrs.push(`${hero} draagt deze kleding: ${appearance.outfit}`);
  if (appearance.distinguishingFeature.trim() && appearance.distinguishingFeature.trim() !== appearance.freeform.trim()) {
    attrs.push(`${hero} heeft dit kenmerk: ${appearance.distinguishingFeature}`);
  }
  for (const character of sceneCharacters) {
    const name = character.name.trim();
    if (!name) continue;
    const look =
      character.appearance.distinguishingFeature.trim() || character.appearance.freeform.trim();
    if (look) attrs.push(`${name} is zichtbaar en ziet er zo uit: ${look}`);
  }
  return attrs;
}

// Bouwt een Nederlandse beschrijving die ELK gestructureerd veld apart en expliciet
// benoemt (in plaats van te vertrouwen op één lange zin), en herhaalt het belangrijkste
// kenmerk aan het eind als geheugensteun — hetzelfde principe als de stijl-hint die al
// prefix+suffix herhaald wordt in lib/image.ts.
export function describeCharacterAppearance(appearance: CharacterAppearance): string {
  const parts: string[] = [];
  // De zin van het kind is de baas — niet een later herschreven veld, en niet het portret.
  if (appearance.freeform) {
    parts.push(
      `GESCHREVEN OMSCHRIJVING (leidend, volg LETTERLIJK, inclusief kleding, broek en schoenen): ${appearance.freeform}`,
    );
  }
  if (appearance.outfit) parts.push(`Kleding en kleuren (NOOIT veranderen): ${appearance.outfit}`);
  if (appearance.hair) parts.push(`Haar (NOOIT veranderen): ${appearance.hair}`);
  if (appearance.skinOrFurTone) parts.push(`Huid-/vachtkleur (NOOIT veranderen): ${appearance.skinOrFurTone}`);
  if (appearance.accessories.length) {
    parts.push(`Accessoires (VERPLICHT, elk apart en duidelijk zichtbaar tekenen): ${appearance.accessories.join(", ")}`);
  }
  if (appearance.companion) parts.push(`Vast gezelschap, altijd mee te tekenen: ${appearance.companion}`);
  const reminder = appearance.distinguishingFeature
    ? ` Het kenmerk dat NOOIT mag ontbreken: ${appearance.distinguishingFeature}.`
    : "";
  return parts.join(". ") + (parts.length ? "." : "") + reminder;
}

// Extra, korte slotzin voor het beeldmodel: identiteit wint altijd van de scènetekst.
export function lockedIdentityRule(): string {
  return "VAST UITERLIJK: zelfde gezicht, haar, kleding, broek, schoenen en kleuren in ELKE plaat. De geschreven omschrijving wint van de scènetekst. Alleen houding, plek en actie mogen veranderen.";
}

export function describeWorldAppearance(world: WorldAppearance): string {
  const parts: string[] = [];
  if (world.freeform) parts.push(`Volledige beschrijving: ${world.freeform}`);
  if (world.setting) parts.push(`Soort omgeving: ${world.setting}`);
  if (world.paletteAndAtmosphere) parts.push(`Kleuren/sfeer: ${world.paletteAndAtmosphere}`);
  const reminder = world.landmark ? ` Vast, herkenbaar element dat altijd mag terugkomen: ${world.landmark}.` : "";
  return parts.join(". ") + (parts.length ? "." : "") + reminder;
}
