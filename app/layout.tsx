import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { themeInitScript } from "@/lib/theme-script";

const balooTwo = Baloo_2({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
      className={`${balooTwo.variable} ${nunito.variable} h-full antialiased`}
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
