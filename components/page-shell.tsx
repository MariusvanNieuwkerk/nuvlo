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
  showReaderSwitch = true,
  size = "wide",
}: {
  children: ReactNode;
  showHomeLink?: boolean;
  showReaderSwitch?: boolean;
  size?: keyof typeof MAX_WIDTH;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col px-4 pb-12 sm:px-6 md:px-8 lg:px-10",
        MAX_WIDTH[size],
      )}
    >
      <header className="nuvlo-header">
        <Link href="/" className="nuvlo-header-logo">
          <Image
            src="/nuvlo-logo.png"
            alt="Nuvlo"
            width={865}
            height={271}
            className="w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src="/nuvlo-logo-night.png"
            alt="Nuvlo"
            width={865}
            height={271}
            className="hidden w-auto object-contain dark:block"
            priority
          />
        </Link>
        {(showReaderSwitch || showHomeLink) && (
          <div className="nuvlo-header-actions">
            {showReaderSwitch && (
              <Link
                href="/wie"
                className="flex items-center justify-center whitespace-nowrap rounded-full bg-primary px-3 py-2 text-center font-heading text-sm font-semibold text-primary-foreground sm:px-4 sm:text-base"
              >
                Iemand anders
              </Link>
            )}
            {showHomeLink && (
              <Link
                href="/"
                className="flex items-center justify-center whitespace-nowrap rounded-full border border-foreground bg-transparent px-3 py-2 text-center font-heading text-sm font-semibold text-foreground sm:px-4 sm:text-base"
              >
                Naar huis
              </Link>
            )}
          </div>
        )}
        <div className="nuvlo-header-toggle">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 sm:gap-8">{children}</main>
    </div>
  );
}
