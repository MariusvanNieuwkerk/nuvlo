// Eén gedeelde Anthropic-client. Alleen server-side te gebruiken (nooit in "use client").
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ontbreekt. Zet deze in .env.local om verhalen te kunnen genereren.",
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

// Instelbaar via env var. Standaard Sonnet 5: dat levert foutloos Nederlands en sterke
// verhalen — belangrijk voor een leesapp. Wie goedkoper wil testen kan in .env.local
// ANTHROPIC_MODEL=claude-haiku-4-5 zetten (sneller/goedkoper, maar meer taalfoutjes).
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
