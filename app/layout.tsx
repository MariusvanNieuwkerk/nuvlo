import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { themeInitScript } from "@/lib/theme-script";

// Fredoka: rond, dik, speels — precies het "kinderboek"-gevoel dat Baloo 2 net miste.
// Google levert Fredoka tot en met gewicht 700 (geen 800), wat prima samengaat met de
// bestaande font-extrabold-koppen: de browser pakt dan gewoon het dichtstbijzijnde (700).
const fredoka = Fredoka({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Nuvlo",
  description: "Bouw samen met je held een avondverhaal — lezen is de sleutel.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    title: "Nuvlo",
    capable: true,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#e8924a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col night-sky font-body text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
