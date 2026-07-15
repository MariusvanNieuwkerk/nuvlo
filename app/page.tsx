import { PageShell } from "@/components/page-shell";
import { HomeHeroView } from "@/components/home-hero-view";
import { listCharacters, listStories } from "@/lib/storage";

// Altijd vers renderen: de home leest live uit Supabase. Zonder dit prerendert
// Next de pagina bij de build, waardoor verwijderde/nieuwe boeken pas na een redeploy
// zichtbaar worden.
export const dynamic = "force-dynamic";

// Home is held-first: één actieve held in beeld, verder lezen / nieuw avontuur,
// en een simpele wissel naar andere helden. Geen boekenplank-als-startpunt.
export default async function HomePage() {
  const [stories, characters] = await Promise.all([listStories(), listCharacters()]);

  return (
    <PageShell showHomeLink={false} size="wide">
      <HomeHeroView stories={stories} characters={characters} />
    </PageShell>
  );
}
