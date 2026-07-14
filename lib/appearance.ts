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
    return {
      freeform: raw.trim() || fallbackFreeform,
      hair: "",
      outfit: "",
      accessories: [],
      companion: "",
      skinOrFurTone: "",
      distinguishingFeature: "",
    };
  }
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    freeform: asTrimmedString(r.freeform) || fallbackFreeform,
    hair: asTrimmedString(r.hair),
    outfit: asTrimmedString(r.outfit),
    accessories: asStringArray(r.accessories),
    companion: asTrimmedString(r.companion),
    skinOrFurTone: asTrimmedString(r.skinOrFurTone),
    distinguishingFeature: asTrimmedString(r.distinguishingFeature),
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

// Voegt één net verdiend voorwerp toe aan het vaste uiterlijk van de held. Het komt in
// `accessories` (dé lijst die lib/image.ts als verplicht-te-tekenen eis meeneemt én die de
// verificatie-loop controleert) én wordt aan de leesbare `freeform`-zin geplakt, zodat de
// volledige beschrijving die overal als basis/vangnet dient het voorwerp ook noemt. Dubbel
// toevoegen wordt voorkomen (idempotent), zodat herhaald aanroepen nooit een rij duplicaten
// oplevert.
export function appendAccessory(appearance: CharacterAppearance, item: string): CharacterAppearance {
  const trimmed = item.trim();
  if (!trimmed) return appearance;
  const already = appearance.accessories.some((a) => a.toLowerCase() === trimmed.toLowerCase());
  if (already) return appearance;
  const freeform = appearance.freeform.trim();
  return {
    ...appearance,
    accessories: [...appearance.accessories, trimmed],
    freeform: freeform ? `${freeform}, ${trimmed}` : trimmed,
  };
}

// De harde-eisen-checklist voor beeldverificatie: precies de kenmerken die eerder silent
// wegvielen (accessoires, het belangrijkste kenmerk, een vast gezelschapsdier). Haar/kleur
// checken we niet apart — die worden al goed meegenomen door de referentiefoto zelf, en te
// veel checks maken de verificatie traag/duur zonder veel extra waarde.
export function requiredCharacterAttributes(appearance: CharacterAppearance): string[] {
  const attrs = [...appearance.accessories];
  if (appearance.distinguishingFeature && !attrs.includes(appearance.distinguishingFeature)) {
    attrs.push(appearance.distinguishingFeature);
  }
  if (appearance.companion && !attrs.includes(appearance.companion)) {
    attrs.push(appearance.companion);
  }
  return attrs.filter((a) => a.trim().length > 0);
}

// Bouwt een Nederlandse beschrijving die ELK gestructureerd veld apart en expliciet
// benoemt (in plaats van te vertrouwen op één lange zin), en herhaalt het belangrijkste
// kenmerk aan het eind als geheugensteun — hetzelfde principe als de stijl-hint die al
// prefix+suffix herhaald wordt in lib/image.ts.
export function describeCharacterAppearance(appearance: CharacterAppearance): string {
  const parts: string[] = [];
  if (appearance.freeform) parts.push(`Volledige beschrijving: ${appearance.freeform}`);
  if (appearance.hair) parts.push(`Haar: ${appearance.hair}`);
  if (appearance.outfit) parts.push(`Kleding: ${appearance.outfit}`);
  if (appearance.skinOrFurTone) parts.push(`Huid-/vachtkleur: ${appearance.skinOrFurTone}`);
  if (appearance.accessories.length) {
    parts.push(`Accessoires (VERPLICHT, elk apart en duidelijk zichtbaar tekenen): ${appearance.accessories.join(", ")}`);
  }
  if (appearance.companion) parts.push(`Vast gezelschap, altijd mee te tekenen: ${appearance.companion}`);
  const reminder = appearance.distinguishingFeature
    ? ` Het kenmerk dat NOOIT mag ontbreken: ${appearance.distinguishingFeature}.`
    : "";
  return parts.join(". ") + (parts.length ? "." : "") + reminder;
}

export function describeWorldAppearance(world: WorldAppearance): string {
  const parts: string[] = [];
  if (world.freeform) parts.push(`Volledige beschrijving: ${world.freeform}`);
  if (world.setting) parts.push(`Soort omgeving: ${world.setting}`);
  if (world.paletteAndAtmosphere) parts.push(`Kleuren/sfeer: ${world.paletteAndAtmosphere}`);
  const reminder = world.landmark ? ` Vast, herkenbaar element dat altijd mag terugkomen: ${world.landmark}.` : "";
  return parts.join(". ") + (parts.length ? "." : "") + reminder;
}
