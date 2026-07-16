import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BookPageProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function BookPage({ label, children, className }: BookPageProps) {
  return (
    <div className={cn("book-page px-6 py-7 sm:px-9 sm:py-10 md:px-11 md:py-12", className)}>
      <p className="relative z-10 mb-3 font-heading text-xs font-bold tracking-[0.2em] text-primary/70 uppercase sm:mb-4 sm:text-sm">
        {label}
      </p>
      <div className="relative z-10 font-body text-[1.15rem] leading-8 whitespace-pre-line text-[oklch(0.28_0.04_60)] sm:text-[1.25rem] sm:leading-9 md:text-[1.3rem]">
        {children}
      </div>
    </div>
  );
}
