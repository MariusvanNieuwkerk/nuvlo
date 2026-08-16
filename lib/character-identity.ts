// Namen van personages moeten hetzelfde wezen blijven, ook als Claude "Verity" schrijft
// en de bibliotheek "Verity de vrolijke gele bal" heeft. Exacte gelijkheid was te streng:
// dan viel het paspoort-plaatje weg en verzín het tekenmodel een nieuw figuur.

const NAME_STOPWORDS = new Set(["de", "het", "een", "the", "a", "an"]);

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

// Bekende personages winnen van nieuwe regels met dezelfde (of bijna dezelfde) naam,
// zodat een paspoort nooit wordt overschreven door een herschreven zin van Claude.
export function mergeCharactersByName<T extends { name: string }>(incoming: T[], known: T[]): T[] {
  const result: T[] = [];
  for (const item of incoming) {
    result.push(findByCharacterName(known, item.name) ?? item);
  }
  for (const item of known) {
    if (!findByCharacterName(result, item.name)) result.push(item);
  }
  return result;
}
