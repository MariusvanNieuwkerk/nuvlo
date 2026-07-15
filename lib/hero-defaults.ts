// Eenvoudige, kindvriendelijke defaults voor kracht/zwakte/vijand wanneer het kind die
// niet zelf invult. De UX vraagt dit bewust niet meer op het formulier (te veel typen);
// de story-engine heeft de velden wél nodig. Genre stuurt de sfeer.
import type { Genre } from "@/lib/types";

const DEFAULTS: Record<Genre, { power: string; weakness: string; enemy: string }> = {
  avontuur: {
    power: "slim plannen maken",
    weakness: "te snel durven",
    enemy: "de Schaduwrover",
  },
  fantasie: {
    power: "magische vonken",
    weakness: "bang in het donker",
    enemy: "de Nachtmeester",
  },
  ruimte: {
    power: "praten met robots",
    weakness: "snel duizelig in de ruimte",
    enemy: "de Donkere Komeet",
  },
  onderwater: {
    power: "ademen onder water",
    weakness: "bang voor diepe grotten",
    enemy: "de Diepzee-kraker",
  },
  dieren: {
    power: "praten met dieren",
    weakness: "te zorgzaam voor iedereen",
    enemy: "de Bosstoring",
  },
  detective: {
    power: "sporen zien die anderen missen",
    weakness: "te nieuwsgierig",
    enemy: "de Geheime Dief",
  },
};

export function fillHeroDefaults(input: {
  name: string;
  world: string;
  genre: Genre;
  power?: string;
  weakness?: string;
  enemy?: string;
}): { name: string; world: string; genre: Genre; power: string; weakness: string; enemy: string } {
  const d = DEFAULTS[input.genre];
  return {
    name: input.name.trim(),
    world: input.world.trim(),
    genre: input.genre,
    power: input.power?.trim() || d.power,
    weakness: input.weakness?.trim() || d.weakness,
    enemy: input.enemy?.trim() || d.enemy,
  };
}
