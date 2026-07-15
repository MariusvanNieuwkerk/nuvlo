"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, Pencil, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

type IllustrationProps = {
  imageUrl: string | null;
  alt: string;
  // True zolang de tekening nog op de achtergrond gemaakt wordt (fase B, zie book-pager.tsx).
  // Dan tonen we een rustige "tekening wordt gemaakt…"-placeholder i.p.v. de "geen tekening"-
  // melding — het kind leest ondertussen verder en het plaatje verschijnt straks als beloning.
  pending?: boolean;
  className?: string;
};

// Hoeveel keer we STIL (zonder dat het kind iets merkt) opnieuw proberen te laden voordat we
// de "opnieuw proberen"-knop tonen. Dit vangt het meest voorkomende geval op: een eenmalige
// hik in het netwerk of een cdn-link die nét niet op tijd klaar was — niet elke afbeelding
// die niet meteen laadt is écht kapot.
const MAX_SILENT_RETRIES = 2;
const SILENT_RETRY_DELAY_MS = 1500;

export function Illustration({ imageUrl, alt, pending, className }: IllustrationProps) {
  // attempt telt mee in de src (als cache-bustende querystring) zodat de browser/Next.js
  // Image-optimizer de afbeelding ECHT opnieuw ophaalt i.p.v. dezelfde mislukte poging uit
  // de cache te herhalen. failed wordt pas true na MAX_SILENT_RETRIES mislukte pogingen —
  // dan pas tonen we de knop, niet meteen bij de eerste hik.
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // Nieuwe afbeelding (nieuw hoofdstuk, of alsnog binnengekomen na pending) → altijd weer
  // vanaf nul beginnen, anders zou een oude mislukking op een heel ander plaatje blijven staan.
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [imageUrl]);

  function handleError() {
    if (attempt < MAX_SILENT_RETRIES) {
      window.setTimeout(() => setAttempt((a) => a + 1), SILENT_RETRY_DELAY_MS);
    } else {
      setFailed(true);
    }
  }

  function retryNow() {
    setFailed(false);
    setAttempt((a) => a + 1);
  }

  if (imageUrl && !failed) {
    // attempt=0 → de originele URL (geen onnodige querystring bij de eerste, meestal
    // succesvolle poging); vanaf attempt 1 een cache-bustende "?retry=N" erachter.
    const src = attempt === 0 ? imageUrl : `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}retry=${attempt}`;
    return (
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-xl sm:rounded-3xl",
          className,
        )}
      >
        <Image key={src} src={src} alt={alt} fill className="object-cover" onError={handleError} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900/95 via-violet-800/90 to-amber-700/70 p-6 text-center shadow-xl sm:rounded-3xl sm:gap-4",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(1.5px_1.5px_at_20%_30%,white,transparent),radial-gradient(1.5px_1.5px_at_70%_20%,white,transparent),radial-gradient(1.5px_1.5px_at_85%_65%,white,transparent),radial-gradient(1.5px_1.5px_at_35%_75%,white,transparent),radial-gradient(1.5px_1.5px_at_55%_50%,white,transparent)]" />
      {failed ? (
        <>
          <Sparkles className="float-soft relative size-10 text-amber-200/90 sm:size-14" />
          <p className="relative max-w-[85%] text-sm text-white/80 sm:max-w-[70%] sm:text-base">
            Oeps, het plaatje wilde niet komen.
          </p>
          <button
            type="button"
            onClick={retryNow}
            className="relative flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 shadow-sm transition-transform active:scale-95 sm:px-6 sm:py-3 sm:text-base"
          >
            <RotateCw className="size-4 sm:size-5" />
            Nog een keer!
          </button>
        </>
      ) : pending ? (
        <>
          <Pencil className="float-soft relative size-10 text-amber-200/90 sm:size-14" />
          <p className="relative max-w-[85%] text-sm text-white/80 sm:max-w-[70%] sm:text-base">
            De tekening wordt gemaakt… lees rustig verder, hij verschijnt zo vanzelf!
          </p>
        </>
      ) : (
        <>
          <Sparkles className="float-soft relative size-10 text-amber-200/90 sm:size-14" />
          <p className="relative max-w-[85%] text-sm text-white/75 sm:max-w-[70%] sm:text-base">
            Er kon nu geen tekening bij deze scène gemaakt worden. Morgen is er weer plek voor
            nieuwe tekeningen!
          </p>
        </>
      )}
    </div>
  );
}
