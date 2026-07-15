// Helden-rooster voor de home: één actieve held in beeld, met makkelijk wisselen.
// Geen aparte "Universe"-laag — puur afgeleid van opgeslagen helden + bestaande boeken.
import type { SavedCharacter, Story } from "@/lib/types";

export type HeroRosterEntry = {
  // Stabiel id: opgeslagen character-id, of "name:finn" voor helden die alleen in boeken bestaan.
  id: string;
  name: string;
  portraitUrl: string | null;
  // Alleen gezet als dit een opgeslagen held is — dan kan "Nieuw avontuur" ?held= gebruiken.
  savedCharacterId: string | null;
  // Boeken die expliciet aan deze opgeslagen held hangen (audit-trail).
  sourceStoryIds: string[];
  // Wereld van het meest recente boek van deze held (hint onder de naam).
  worldHint: string | null;
  // Meest recente updatedAt van boeken van deze held — voor default-actieve-held.
  lastStoryAt: string | null;
};

function normName(name: string): string {
  return name.trim().toLowerCase();
}

function nameKey(name: string): string {
  return `name:${normName(name)}`;
}

function storyMatchesHero(story: Story, hero: HeroRosterEntry): boolean {
  if (hero.sourceStoryIds.includes(story.id)) return true;
  return normName(story.hero.name) === normName(hero.name);
}

export function storiesForHero(stories: Story[], hero: HeroRosterEntry): Story[] {
  return stories.filter((s) => storyMatchesHero(s, hero));
}

export function continueStoryForHero(stories: Story[], hero: HeroRosterEntry): Story | null {
  const mine = storiesForHero(stories, hero);
  const open = mine.find((s) => s.status === "bezig");
  if (open) return open;
  return mine[0] ?? null;
}

// Bouwt het helden-rooster: eerst opgeslagen helden, daarna unieke held-namen uit boeken
// die nog niet in de bibliotheek staan (zodat oude boeken niet "zweven" zonder held).
export function buildHeroRoster(
  characters: SavedCharacter[],
  stories: Story[],
): HeroRosterEntry[] {
  const savedHeroes = characters.filter((c) => c.kind === "hero");
  const savedNames = new Set(savedHeroes.map((c) => normName(c.name)));

  const byNameStories = new Map<string, Story[]>();
  for (const story of stories) {
    const key = normName(story.hero.name);
    if (!key) continue;
    const list = byNameStories.get(key) ?? [];
    list.push(story);
    byNameStories.set(key, list);
  }

  function metaForName(name: string): { portraitUrl: string | null; worldHint: string | null; lastStoryAt: string | null } {
    const list = byNameStories.get(normName(name)) ?? [];
    // stories komen al favorite/updated_at-gesorteerd binnen; eerste = meest recent.
    const latest = list[0];
    return {
      portraitUrl: latest?.character.portraitUrl ?? null,
      worldHint: latest?.hero.world?.trim() || null,
      lastStoryAt: latest?.updatedAt ?? null,
    };
  }

  const roster: HeroRosterEntry[] = savedHeroes.map((c) => {
    const meta = metaForName(c.name);
    // Portret: liever het opgeslagen ankerbeeld; anders uit het laatste boek.
    return {
      id: c.id,
      name: c.name,
      portraitUrl: c.portraitUrl ?? meta.portraitUrl,
      savedCharacterId: c.id,
      sourceStoryIds: c.sourceStoryIds,
      worldHint: meta.worldHint,
      lastStoryAt: meta.lastStoryAt,
    };
  });

  for (const [, list] of byNameStories) {
    const latest = list[0];
    if (!latest) continue;
    if (savedNames.has(normName(latest.hero.name))) continue;
    roster.push({
      id: nameKey(latest.hero.name),
      name: latest.hero.name,
      portraitUrl: latest.character.portraitUrl,
      savedCharacterId: null,
      sourceStoryIds: [],
      worldHint: latest.hero.world?.trim() || null,
      lastStoryAt: latest.updatedAt,
    });
  }

  // Meest recent gespeelde held eerst — prettiger voor de wissel-rij.
  roster.sort((a, b) => {
    const ta = a.lastStoryAt ? Date.parse(a.lastStoryAt) : 0;
    const tb = b.lastStoryAt ? Date.parse(b.lastStoryAt) : 0;
    return tb - ta;
  });

  return roster;
}

export function pickDefaultHeroId(roster: HeroRosterEntry[], preferredId: string | null): string | null {
  if (roster.length === 0) return null;
  if (preferredId && roster.some((h) => h.id === preferredId)) return preferredId;
  return roster[0]?.id ?? null;
}
