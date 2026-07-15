import { PageShell } from "@/components/page-shell";
import { HomeHeroView } from "@/components/home-hero-view";
import { getDefaultChild, listCharacters, listStories } from "@/lib/storage";

// Altijd vers renderen: de home leest live uit Supabase. Zonder dit prerendert
// Next de pagina bij de build, waardoor verwijderde/nieuwe boeken pas na een redeploy
// zichtbaar worden.
export const dynamic = "force-dynamic";

// Home is held-first: één actieve held in beeld, verder lezen / nieuw avontuur,
// en een simpele wissel naar andere helden. Beheer (bewerken/verwijderen) gebeurt
// vanaf het grote held-portret.
export default async function HomePage() {
  const [stories, characters, child] = await Promise.all([
    listStories(),
    listCharacters(),
    getDefaultChild(),
  ]);

  return (
    <PageShell showHomeLink={false} size="wide">
      <HomeHeroView stories={stories} characters={characters} child={child} />
    </PageShell>
  );
}
