# Nuvlo

Een Nederlandstalige avond-leesapp voor kinderen (6–11 jaar). Kinderen bouwen hun eigen boek:
ze verzinnen een held, lezen een scène die eindigt op een cliffhanger, en kiezen uit drie
opties hoe het verhaal verdergaat.

## Status: Fase 1 — skelet zonder AI

Deze fase draait volledig lokaal, zonder accounts en zonder AI-aanroepen. Er is één
hardcoded voorbeeldverhaal zodat alle schermen te testen zijn.

- **Opslag**: `data/stories.json` (wordt automatisch aangemaakt, staat niet in git)
- **Verhaalregisseur**: `lib/story-director.ts` — nu een sjabloon-generator; in fase 2
  wordt de binnenkant vervangen door echte Anthropic (Claude)-aanroepen, zonder dat de
  rest van de app verandert
- **Schermen**: Home (`/`), Nieuw verhaal (`/nieuw-verhaal`), Lezen
  (`/verhaal/[id]/lezen`), Mijn boek (`/verhaal/[id]/boek`)

## Starten

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Volgende fases

1. ~~Fase 1 — Skelet zonder AI~~ ✅
2. Fase 2 — Tekst-AI (`lib/story-director.ts` met echte Claude-aanroepen via een
   serverless route). Vereist `ANTHROPIC_API_KEY` en `ANTHROPIC_MODEL`.
3. Fase 3 — Prompt-tuning (system prompt bijstellen voor cliffhangers, leesbegrip,
   terugkerende draadjes).
4. Fase 4 — Beelden via fal.ai (`lib/image.ts`). Vereist `FAL_KEY`.
5. Fase 5 — Customisatie-unlocks bij akte-beats.

## Tech-stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Lokale opslag in fase 1, later vervangen door Supabase
