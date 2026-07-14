// Bijhouden hoeveel illustraties er vandaag per kind gemaakt zijn — Supabase-versie.
// Atomaire quota-claim via een PostgreSQL-functie (claim_image_quota): de increment-
// AND-count-check gebeurt in één UPDATE met WHERE count < max, dus twee gelijktijdige
// aanvragen kunnen de limiet nooit allebei passeren (vroeger lib/locks.ts, dat alleen
// binnen één proces werkte en dus op Vercel serverless niet volstond).

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten in .env.local staan (server-only).",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Verstandige lage default (15) als de env var ontbreekt — zie oude image-usage.ts voor
// de afweging (één plaatje per hoofdstuk × ~14 hoofdstukken + 1 portret, en een harde
// rem op losgeslagen lussen).
function maxPerDay(): number {
  const raw = Number(process.env.MAX_IMAGES_PER_DAY_PER_CHILD);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

// Atomaire claim: INSERT count=1 (eerste plaatje vandaag), of UPDATE count=count+1
// alleen als count < max. Geeft true als de claim lukte, false als de limiet bereikt is.
export async function tryClaimImageQuota(childId: string): Promise<boolean> {
  const { data, error } = await client().rpc("claim_image_quota", {
    p_child_id: childId,
    p_date: todayKey(),
    p_max: maxPerDay(),
  });
  if (error) return false;
  return Boolean(data);
}

// Geeft een geclaimde illustratie terug als fal.ai toch faalde (zie oude uitleg).
// Atomaire UPDATE count = greatest(count-1, 0) voor vandaag.
export async function releaseImageQuota(childId: string): Promise<void> {
  await client().rpc("release_image_quota", {
    p_child_id: childId,
    p_date: todayKey(),
  });
}

export async function getRemainingImageQuota(childId: string): Promise<number> {
  const { data, error } = await client()
    .from("image_usage")
    .select("count")
    .eq("child_id", childId)
    .eq("date", todayKey())
    .maybeSingle();
  if (error || !data) return maxPerDay();
  const count = (data as { count: number }).count ?? 0;
  return Math.max(0, maxPerDay() - count);
}
