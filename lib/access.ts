// Regels voor wie een kind, boek of personage mag zien.
// Dit bestand praat niet met de database. De tests kunnen het daarom
// los controleren. De server gebruikt dezelfde regels vóór elke lees- of schrijfactie.

export const CHILD_COOKIE = "nuvlo_child";

export function childCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  };
}

// Een kind hoort bij een gezin alleen als het gezin echt is ingevuld én gelijk is
// aan de ingelogde ouder. Een leeg gezin (oude boeken) hoort bij niemand.
export function familyOwnsChild(
  userId: string | null | undefined,
  childFamilyId: string | null | undefined,
): boolean {
  if (!userId || !childFamilyId) return false;
  return userId === childFamilyId;
}

// Een boek of personage hoort bij het kind dat nu gekozen is.
// Alleen hetzelfde id uit de browser is niet genoeg: dit vergelijkt met de
// server, nadat het kind al bij de ouder hoort.
export function childOwnsRecord(
  activeChildId: string | null | undefined,
  recordChildId: string | null | undefined,
): boolean {
  if (!activeChildId || !recordChildId) return false;
  return activeChildId === recordChildId;
}

export function canReadOwnedRecord(input: {
  userId: string | null | undefined;
  childFamilyId: string | null | undefined;
  activeChildId: string | null | undefined;
  recordChildId: string | null | undefined;
}): boolean {
  return (
    familyOwnsChild(input.userId, input.childFamilyId) &&
    childOwnsRecord(input.activeChildId, input.recordChildId)
  );
}

// De beheerder is alleen het e-mailadres in NUVLO_ADMIN_EMAIL.
// Leeg adres = niemand. Hoofdletters maken niet uit.
export function isLibraryAdmin(
  email: string | null | undefined,
  adminEmail: string | null | undefined,
): boolean {
  const left = email?.trim().toLowerCase() ?? "";
  const right = adminEmail?.trim().toLowerCase() ?? "";
  if (!left || !right) return false;
  return left === right;
}

// Alleen de beheerder mag een kind zonder gezin koppelen.
// Een kind dat al een gezin heeft, blijft daar.
export function canClaimUnassignedChild(
  isAdmin: boolean,
  childFamilyId: string | null | undefined,
): boolean {
  return isAdmin && childFamilyId === null;
}
