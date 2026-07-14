import Image from "next/image";
import { Sparkles, Pencil } from "lucide-react";
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

export function Illustration({ imageUrl, alt, pending, className }: IllustrationProps) {
  if (imageUrl) {
    return (
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-xl sm:rounded-3xl",
          className,
        )}
      >
        <Image src={imageUrl} alt={alt} fill className="object-cover" />
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
      {pending ? (
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
