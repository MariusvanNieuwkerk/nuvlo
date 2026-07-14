// Tekenstijlen die het kind kan kiezen bij het starten van een nieuw verhaal.
// Dit is een losse stap van het vrije uiterlijk (zie hero-form.tsx): de "imageStyleHint"
// hier is een expliciete, Engelse kunststijl-aanwijzing die we ALTIJD direct gebruiken voor
// character.imageStyleHint (overschrijft de eigen inschatting van Claude), zodat de
// illustratie-AI betrouwbaar in de juiste stijl tekent — Engelse vaktermen sturen het
// beeldmodel veel sterker dan een Nederlandse omschrijving.
//
// VISUEEL: per stijl één lucide-lijn-icoon (één kleur, dikke ronde lijn) i.p.v. emoji —
// speels maar minimaal, en scherper leesbaar op klein formaat. `swatch` blijft bewaard als
// zacht kleur-accent achter het icoon (kleine cirkel), niet langer als vak-achtergrond.

import {
  Bone,
  Box,
  Gamepad2,
  Palette,
  PawPrint,
  Pickaxe,
  Rainbow,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";

export type ImageStyleId =
  | "default"
  | "minecraft"
  | "roblox"
  | "anime"
  | "pokemon"
  | "ninja"
  | "gamer"
  | "eenhoorn"
  | "dino";

export type ImageStyleOption = {
  id: ImageStyleId;
  label: string;
  // Lijn-icoon (lucide-react) — geeft de "speels maar minimaal" look met één kleur.
  icon: LucideIcon;
  // Tailwind-achtergrondkleur voor het zachte kleur-accent achter het icoon (geen vak-vul meer).
  swatch: string;
  imageStyleHint: string;
};

export const DEFAULT_IMAGE_STYLE_ID: ImageStyleId = "default";

export const IMAGE_STYLES: ImageStyleOption[] = [
  {
    id: "default",
    label: "Gewoon een vrolijke tekening",
    icon: Palette,
    swatch: "bg-orange-200",
    imageStyleHint:
      "flat colorful 2D children's picture-book illustration style, warm and cheerful, simple clean shapes, soft rounded lines",
  },
  {
    id: "minecraft",
    label: "Minecraft-avontuur",
    icon: Pickaxe,
    swatch: "bg-lime-200",
    imageStyleHint:
      "Minecraft voxel art style, blocky cubic shapes, sharp 90-degree edges, NOT round, NOT smooth, bright cheerful colors",
  },
  {
    id: "roblox",
    label: "Roblox-figuur",
    icon: Box,
    swatch: "bg-sky-200",
    imageStyleHint:
      "Roblox-style blocky plastic toy-figure art, chunky cylindrical limbs, smooth glossy plastic look, simple blocky head, bright toy colors",
  },
  {
    id: "anime",
    label: "Anime-held",
    icon: Sparkles,
    swatch: "bg-fuchsia-200",
    imageStyleHint:
      "anime style, big sparkly expressive eyes, cel-shaded, vibrant spiky hair, clean bold outlines, dynamic action pose",
  },
  {
    id: "pokemon",
    label: "Pokémon-trainer",
    icon: PawPrint,
    swatch: "bg-amber-200",
    imageStyleHint:
      "bright Pokémon-style anime/game art, clean bold outlines, big friendly eyes, vivid saturated colors, adventurous game-box illustration look",
  },
  {
    id: "ninja",
    label: "Ninja",
    icon: Swords,
    swatch: "bg-indigo-200",
    imageStyleHint:
      "stylized action-adventure illustration, bold dynamic silhouettes, dramatic poses, moody but cheerful color palette, comic-style shading",
  },
  {
    id: "gamer",
    label: "Gamer",
    icon: Gamepad2,
    swatch: "bg-cyan-200",
    imageStyleHint:
      "vibrant neon digital-art style, glowing highlights, sleek modern video-game illustration look, energetic bright colors",
  },
  {
    id: "eenhoorn",
    label: "Eenhoorn-fantasie",
    icon: Rainbow,
    swatch: "bg-rose-200",
    imageStyleHint:
      "soft pastel fantasy illustration, dreamy glowing sparkles, gentle rounded shapes, magical whimsical storybook look",
  },
  {
    id: "dino",
    label: "Dino-ontdekker",
    icon: Bone,
    swatch: "bg-emerald-200",
    imageStyleHint:
      "adventurous storybook illustration style, warm earthy colors, bold friendly shapes, jungle-explorer picture-book look",
  },
];

export function getImageStyle(id: string | null | undefined): ImageStyleOption | undefined {
  if (!id) return undefined;
  return IMAGE_STYLES.find((s) => s.id === id);
}

// Zoekt de tekenstijl op basis van de Engelse imageStyleHint — handig bij hergebruik van een
// opgeslagen personage (SavedCharacter.imageStyleHint), zodat we in de UI weer de juiste
// tegel kunnen voorselecteren. Geen exacte match → terugval op default.
export function getImageStyleByHint(hint: string | null | undefined): ImageStyleOption {
  const fallback = IMAGE_STYLES.find((s) => s.id === DEFAULT_IMAGE_STYLE_ID)!;
  if (!hint || !hint.trim()) return fallback;
  const needle = hint.trim().toLowerCase();
  const hit = IMAGE_STYLES.find((s) => s.imageStyleHint.trim().toLowerCase() === needle);
  if (hit) return hit;
  // Bevat-deel match: zo vinden we ook stijlen terug als er ergens een hint is opgeslagen
  // die niet exact overeenkomt (bv. omdat Claude hem licht hernoemde).
  const partial = IMAGE_STYLES.find(
    (s) => s.id !== DEFAULT_IMAGE_STYLE_ID && needle.includes(s.id),
  );
  return partial ?? fallback;
}
