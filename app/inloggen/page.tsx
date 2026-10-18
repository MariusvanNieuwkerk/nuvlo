import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getActiveChildForUser, getSessionUser } from "@/lib/reader";
import { signIn, signUp } from "./actions";

export const dynamic = "force-dynamic";

function foutTekst(code: string | undefined) {
  if (code === "leeg") return "Vul je e-mail in en een wachtwoord van minstens 8 tekens.";
  if (code === "mail") return "Kijk in je e-mail en tik op de bevestiging. Daarna kun je inloggen.";
  if (code === "email") return "Gebruik een echt e-mailadres, bijvoorbeeld van Gmail of iCloud.";
  if (code === "bestaat") return "Dit account bestaat al. Tik op Inloggen.";
  if (code === "geen-account") return "Dit account bestaat nog niet. Tik op Nieuw account maken.";
  if (code === "controleer") return "Dat lukte niet. Probeer het nog eens.";
  return null;
}

export default async function InloggenPage({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    const child = await getActiveChildForUser(user.id);
    redirect(child ? "/" : "/wie");
  }

  const { fout } = await searchParams;
  const melding = foutTekst(fout);

  return (
    <PageShell size="narrow" showHomeLink={false} showReaderSwitch={false}>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Account van de ouder</h1>
        <p className="text-lg text-foreground/70">
          De eerste keer maak je een account. Daarna gebruik je Inloggen.
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-base font-semibold text-foreground">
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-14 rounded-2xl border border-foreground/15 bg-background px-4 text-lg font-normal"
          />
        </label>
        <label className="flex flex-col gap-2 text-base font-semibold text-foreground">
          Wachtwoord, minstens 8 tekens
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="min-h-14 rounded-2xl border border-foreground/15 bg-background px-4 text-lg font-normal"
          />
        </label>
        {melding && (
          <p className="rounded-2xl border border-foreground/40 px-4 py-3 text-base text-foreground">{melding}</p>
        )}
        <button
          formAction={signUp}
          className="min-h-14 rounded-full bg-primary px-6 font-heading text-xl font-extrabold text-primary-foreground"
        >
          Nieuw account maken
        </button>
        <button
          formAction={signIn}
          className="min-h-14 rounded-full border border-foreground bg-transparent px-6 font-heading text-lg font-bold text-foreground"
        >
          Inloggen
        </button>
      </form>
    </PageShell>
  );
}
