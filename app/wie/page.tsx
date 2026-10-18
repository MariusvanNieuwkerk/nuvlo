import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getSessionUser } from "@/lib/reader";
import { listChildrenForFamily } from "@/lib/storage";
import { chooseChild, createChild, signOutParent } from "./actions";

export const dynamic = "force-dynamic";

function foutTekst(code: string | undefined) {
  if (code === "naam") return "Vul een naam in.";
  if (code === "leeftijd") return "Kies een leeftijd tussen 4 en 14.";
  if (code === "vol") return "Er passen niet meer kinderen bij dit gezin.";
  if (code === "kind") return "Dat profiel hoort niet bij dit account.";
  if (code === "beheerder") return "Alleen de beheerder kan de oude boeken koppelen.";
  return null;
}

export default async function WiePage({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string; gekoppeld?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/inloggen");

  const children = await listChildrenForFamily(user.id);
  const { fout, gekoppeld } = await searchParams;
  const melding = foutTekst(fout);
  const gekoppeldAantal = gekoppeld === undefined ? null : Number(gekoppeld);
  const leeftijden = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  return (
    <PageShell size="narrow" showHomeLink={false} showReaderSwitch={false}>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-extrabold text-foreground sm:text-4xl">
          Wie gaat er lezen?
        </h1>
        <p className="text-lg text-foreground/70">Tik op je naam.</p>
      </div>

      {melding && (
        <p className="rounded-2xl border border-foreground/40 px-4 py-3 text-base text-foreground">{melding}</p>
      )}
      {gekoppeldAantal !== null && Number.isFinite(gekoppeldAantal) && (
        <p className="rounded-2xl border border-foreground/40 px-4 py-3 text-base text-foreground">
          {gekoppeldAantal > 0
            ? `De oude boeken zijn gekoppeld: ${gekoppeldAantal} ${gekoppeldAantal === 1 ? "boek" : "boeken"}.`
            : "Er stonden geen losse boeken meer."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {children.map((child) => (
          <form key={child.id} action={chooseChild}>
            <input type="hidden" name="childId" value={child.id} />
            <button className="flex min-h-20 w-full items-center gap-4 rounded-3xl bg-primary px-5 text-left font-heading text-2xl font-extrabold text-primary-foreground sm:text-3xl">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-3xl text-primary">
                {child.name.slice(0, 1).toUpperCase()}
              </span>
              {child.name}
            </button>
          </form>
        ))}
      </div>

      <form action={createChild} className="flex flex-col gap-3 rounded-3xl border border-foreground/40 p-4">
        <h2 className="font-heading text-xl font-extrabold text-foreground">Nieuw kind</h2>
        <input
          name="name"
          placeholder="Naam"
          maxLength={40}
          className="min-h-14 rounded-2xl border border-foreground/15 bg-background px-4 text-lg"
        />
        <label className="flex items-center justify-between gap-3 text-base font-semibold">
          Leeftijd
          <select
            name="age"
            defaultValue="8"
            className="min-h-14 rounded-2xl border border-foreground/15 bg-background px-4 text-lg"
          >
            {leeftijden.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-14 rounded-full bg-primary px-6 font-heading text-lg font-bold text-primary-foreground">
          Kind toevoegen
        </button>
      </form>

      <form action={signOutParent}>
        <button className="text-base font-semibold text-foreground/60 underline-offset-4 hover:underline">
          Ouder uitloggen
        </button>
      </form>
    </PageShell>
  );
}
