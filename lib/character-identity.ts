// Eén identiteit-slot voor elk personage: vaste naam, vaste zin, één paspoort.
// Claude mag het verhaal schrijven. Code bepaalt wie hetzelfde wezen is.

const NAME_STOPWORDS = new Set(["de", "het", "een", "the", "a", "an"]);
const POSSESSIVES = new Set(["zijn", "haar", "hun", "mijn", "jouw"]);
const WEAK_MODIFIERS = new Set([
  "klein",
  "kleine",
  "groot",
  "grote",
  "jong",
  "jonge",
  "oud",
  "oude",
  "lief",
  "lieve",
  "nieuw",
  "nieuwe",
]);
const GENERIC_CORES = new Set([
  "jongetje",
  "jongen",
  "meisje",
  "kind",
  "kinderen",
  "vriendje",
  "vriendinnetje",
  "vriend",
  "vriendin",
  "maatje",
  "hulpje",
  "begeleider",
  "figuur",
  "figuurtje",
  "wezen",
  "persoon",
  "persoontje",
]);

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function characterNamesMatch(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.startsWith(`${right} `) || right.startsWith(`${left} `)) return true;
  const firstLeft = left.split(" ")[0] ?? "";
  const firstRight = right.split(" ")[0] ?? "";
  if (
    firstLeft &&
    firstLeft === firstRight &&
    firstLeft.length >= 3 &&
    !NAME_STOPWORDS.has(firstLeft)
  ) {
    return true;
  }
  return false;
}

export function findByCharacterName<T extends { name: string }>(
  list: T[],
  name: string,
): T | undefined {
  return list.find((item) => characterNamesMatch(item.name, name));
}

// "een jongetje" / "zijn vriendje" is geen nieuw personage naast een gekozen figuur.
export function isGenericCharacterAlias(name: string): boolean {
  const tokens = normalizeName(name)
    .split(" ")
    .filter((token) => token && !NAME_STOPWORDS.has(token) && !POSSESSIVES.has(token) && !WEAK_MODIFIERS.has(token));
  if (tokens.length === 0) return true;
  return tokens.every((token) => GENERIC_CORES.has(token));
}

export function nameMentionedInText(name: string, text: string): boolean {
  const hay = normalizeName(text);
  const full = normalizeName(name);
  if (!hay || !full) return false;
  if (full.length >= 3 && hay.includes(full)) return true;
  const first = full.split(" ")[0] ?? "";
  if (!first || first.length < 3 || NAME_STOPWORDS.has(first) || GENERIC_CORES.has(first)) {
    return false;
  }
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(first)}(?:[^a-z0-9]|$)`).test(hay);
}

export function charactersMentionedInText<T extends { name: string }>(
  registry: T[],
  texts: string[],
): T[] {
  const hay = texts.filter(Boolean).join("\n");
  return registry.filter((item) => nameMentionedInText(item.name, hay));
}

// Bekende personages winnen van nieuwe regels met dezelfde (of bijna dezelfde) naam,
// zodat een paspoort nooit wordt overschreven door een herschreven zin van Claude.
export function mergeCharactersByName<T extends { name: string }>(incoming: T[], known: T[]): T[] {
  return lockCharacterRegistry(incoming, known);
}

// Registry-slot: bekende naam houdt uiterlijk + paspoort. Alleen een écht nieuwe naam
// mag erbij. Een los "jongetje" naast Wiebel wordt weggegooid.
export function lockCharacterRegistry<T extends { name: string }>(incoming: T[], known: T[]): T[] {
  const locked: T[] = [];
  for (const item of incoming) {
    const existing = findByCharacterName(known, item.name);
    if (existing) {
      if (!findByCharacterName(locked, existing.name)) locked.push(existing);
      continue;
    }
    if (known.length > 0 && isGenericCharacterAlias(item.name)) continue;
    if (!findByCharacterName(locked, item.name)) locked.push(item);
  }
  for (const item of known) {
    if (!findByCharacterName(locked, item.name)) locked.push(item);
  }
  return locked;
}

// Wie hoort in DÉZE tekening: Claude's lijst, namen in de tekst, plus figuren die
// het kind vooraf koos (die moeten in hoofdstuk 1 altijd mee).
export function resolveLockedSceneCharacters<T extends { name: string }>(
  registry: T[],
  options: {
    namedByClaude?: string[];
    texts?: string[];
    alwaysIncludeNames?: string[];
  } = {},
): T[] {
  const named: T[] = [];
  const add = (item: T | undefined) => {
    if (!item || findByCharacterName(named, item.name)) return;
    named.push(item);
  };

  for (const name of options.namedByClaude ?? []) {
    add(findByCharacterName(registry, name));
  }
  for (const item of charactersMentionedInText(registry, options.texts ?? [])) {
    add(item);
  }
  for (const name of options.alwaysIncludeNames ?? []) {
    add(findByCharacterName(registry, name));
  }

  return named;
}
