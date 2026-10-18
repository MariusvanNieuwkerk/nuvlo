import "server-only";
import { isLibraryAdmin } from "@/lib/access";
import { claimUnassignedChildren } from "@/lib/storage";

// Eenmalig de oude boeken aan dit ouderaccount hangen.
// Aanmelden roept dit nooit aan. Alleen het e-mailadres in NUVLO_ADMIN_EMAIL mag het.
export async function claimLibraryAsAdmin(user: { id: string; email?: string | null }) {
  if (!isLibraryAdmin(user.email, process.env.NUVLO_ADMIN_EMAIL)) {
    return {
      ok: false as const,
      error: "Alleen de beheerder kan de bestaande boeken koppelen.",
    };
  }
  const counts = await claimUnassignedChildren(user.id);
  return { ok: true as const, counts };
}
