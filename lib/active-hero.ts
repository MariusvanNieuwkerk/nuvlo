// Onthoud welke held het kind nu "speelt". Bewust alleen in de browser (localStorage) —
// geen database-migratie nodig, en per apparaat voelt het natuurlijk aan.
const STORAGE_KEY = "nuvlo.activeHeroId";

export function readActiveHeroId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function writeActiveHeroId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode / volle storage: stil negeren — default-held blijft werken.
  }
}
