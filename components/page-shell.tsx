import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const MAX_WIDTH = {
  narrow: "max-w-md sm:max-w-xl md:max-w-2xl",
  // Base en sm: breed genoeg om iPad-landscape (met Safari-zijbalk ~600-900px) te vullen;
  // pas op groot desktop-liggend scherm (lg+) cap je de leesbreedte.
  wide: "max-w-2xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl",
} as const;

export function PageShell({
  children,
  showHomeLink = true,
  size = "wide",
}: {
  children: ReactNode;
  showHomeLink?: boolean;
  size?: keyof typeof MAX_WIDTH;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col px-4 pb-12 sm:px-6 md:px-8 lg:px-10",
        MAX_WIDTH[size],
      )}
    >
      <header className="flex items-center justify-between py-5 sm:py-7">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5">
          <Image
            src="/nuvlo-logo.png"
            alt="Nuvlo"
            width={32}
            height={32}
            className="size-8 object-contain sm:size-9"
            priority
          />
          <span className="font-heading text-lg font-extrabold text-foreground sm:text-xl">
            Nuvlo
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {showHomeLink && (
            <Link
              href="/"
              className="rounded-full bg-foreground/10 px-3.5 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-foreground/20 sm:px-4 sm:text-base"
            >
              Home
            </Link>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 sm:gap-8">{children}</main>
    </div>
  );
}
