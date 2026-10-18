// Eenmalig: hang de oude boeken (kinderen zonder gezin) aan het beheeraccount.
// Aanmelden doet dit niet. Zet eerst NUVLO_ADMIN_EMAIL in .env.local.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/claim-library.ts

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

async function loadEnvLocal() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env al gezet
  }
}

async function main() {
  await loadEnvLocal();
  const email = process.env.NUVLO_ADMIN_EMAIL?.trim().toLowerCase();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email) {
    console.error("Zet NUVLO_ADMIN_EMAIL in .env.local op het e-mailadres van jouw account.");
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error("SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const user = data.users.find((item) => item.email?.trim().toLowerCase() === email);
  if (!user) {
    console.error("Geen account met dat e-mailadres. Maak eerst het account in Nuvlo.");
    process.exit(1);
  }

  const { claimUnassignedChildren } = await import("@/lib/storage");
  const counts = await claimUnassignedChildren(user.id);
  console.log(
    `Gekoppeld: ${counts.children} kindprofiel(en), ${counts.stories} boeken, ${counts.characters} personages.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
