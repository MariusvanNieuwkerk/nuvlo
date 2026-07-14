import type { Genre } from "@/lib/types";

// Elk genre krijgt een eigen kleurrijke boek-cover, zodat het "boekenrek" op Home
// er speels en gevarieerd uitziet in plaats van allemaal dezelfde kleur.
export const GENRE_COVER: Record<Genre, { gradient: string; emoji: string }> = {
  avontuur: { gradient: "from-orange-400 via-amber-400 to-yellow-300", emoji: "🗺️" },
  fantasie: { gradient: "from-emerald-400 via-teal-400 to-green-300", emoji: "🐉" },
  ruimte: { gradient: "from-violet-500 via-purple-400 to-indigo-300", emoji: "🚀" },
  onderwater: { gradient: "from-sky-400 via-cyan-400 to-teal-300", emoji: "🐬" },
  dieren: { gradient: "from-amber-500 via-orange-400 to-rose-300", emoji: "🦊" },
  detective: { gradient: "from-slate-500 via-slate-400 to-zinc-300", emoji: "🔍" },
};
