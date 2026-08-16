# Nuvlo — Blueprint

> **Simple at the front. Intelligent at the back.**
>
> Nuvlo is geen AI-product dat toevallig over lezen gaat. Het is een **leesproduct dat AI
> gebruikt** — alleen waar dat helpt om kinderen vrijwillig zelf te laten lezen. De kernvraag bij
> elke feature: *zorgt dit ervoor dat het kind méér zin krijgt om zelf te lezen?* Zo niet →
> parkeren. Productnaam voor die richting: **Curiosity-Driven Reading** (zie §14).
>
> Dit document beschrijft hoe Nuvlo in elkaar zit: wat het is, hoe het technisch werkt, welke
> keuzes bewust gemaakt zijn (en waarom), en waar je moet zijn in de code. Geschreven in gewone
> taal, met verwijzingen naar echte bestanden — geen losstaande theorie. De lange-termijnvisie
> (het levende universum van het kind) staat in §16 — nog niet bouwen, wél als kompas bij elke
> nieuwe feature.

## 1. Wat is Nuvlo?

Nuvlo is een Nederlandstalige **lees- en verhaalbouw-app voor kinderen van 6 tot 11 jaar**.
Kinderen lezen **zelfstandig** en bouwen hun eigen geïllustreerde avontuur: ze verzinnen een held,
lezen scènes die eindigen op een cliffhanger, kiezen hoe het verdergaat, en zo groeit het boek
hoofdstuk voor hoofdstuk — tot een afgerond einde na ongeveer 14 hoofdstukken. Hoe *zoet* of
*spannend* dat einde aanvoelt, schaalt mee met de leeftijd van het kind (zie §5): jong = altijd
warm en veilig; ouder = echte tegenslag en een bitterzoete of openere afloop mogen.

**Belangrijk — wat Nuvlo níet is:** geen voorleesapp, geen bedtime-story-app, geen app waarin
een ouder voorleest terwijl het kind alleen luistert. Het kind is de lezer én de mede-maker.
Een ouder mag meekijken of helpen bij het starten, maar de kernervaring is: *zelf lezen* en
*zelf het verhaal sturen*.

Kernbeloften aan het kind:
- **Zelfstandig lezen** — de tekst is het product; de app beloont nieuwsgierigheid door te lezen,
  niet door te luisteren of door korte taps zonder lezen.
- **Een held die van hem/haar is** — zelf verzonnen naam, uiterlijk, optionele skills en
  tekenstijl, die het hele boek (en volgende boeken) hetzelfde blijven.
- **Elke scène een eigen tekening** — een AI-geïllustreerd plaatje per hoofdstuk, gemaakt terwijl
  het kind al leest.
- **Personages die je kunt bewaren** — een held of een leuk nevenpersonage opslaan (technisch:
  de personagebibliotheek; later in de UX mogelijk “Mijn Wereld”, zie §16), om in een volgend
  boek terug te laten komen.
- **Puur lezen en bouwen, geen ballast** — geen enge dingen, geen agressieve gamification, geen
  advertenties.

## 2. Techstack

| Laag | Keuze | Waarom |
|---|---|---|
| Framework | **Next.js 15** (App Router, React 19) | Server components voor databasewerk, API routes voor mutaties, één codebase voor front- en backend. |
| Taal | **TypeScript** | Eén gedeeld datamodel (`lib/types.ts`) tussen server en client. |
| Styling | **Tailwind CSS v4** + eigen componenten (shadcn-stijl, `components/ui/*`) | Snel, consistent, geen zware component-library. |
| Tekst-AI | **Anthropic Claude** (`ANTHROPIC_MODEL`, default `claude-sonnet-5`) via **tool-use** | Gestructureerde, altijd-geldige JSON terug (geen losse tekst parsen). |
| Beeld-AI | **fal.ai**, model **Nano Banana 2** (`fal-ai/nano-banana-2`) | Scène-composer: zelfde personage, nieuwe compositie. Lite is bewust niet de default (zie §6). |
| Database | **Supabase (Postgres)** | Managed Postgres met Row Level Security, plus `jsonb`-kolommen voor de flexibele verhaalstructuur. |
| Hosting | **Vercel** | Automatische deploy vanaf GitHub `main`, serverless functions voor de API-routes. |
| Versiebeheer | **GitHub** (`MariusvanNieuwkerk/nuvlo`) | — |

Belangrijkste dependencies (`package.json`): `@anthropic-ai/sdk`, `@fal-ai/client`,
`@supabase/supabase-js`, `next`, `react`/`react-dom` 19, `lucide-react` (iconen),
`@base-ui/react` (headless UI-primitives onder `components/ui`).

## 3. Architectuur op hoofdlijnen

```
┌─────────────────────────────┐
│  Browser (React, "use client") │
│  - home-hero-view, hero-form, book-pager │
└───────────────┬─────────────┘
                │ fetch()
┌───────────────▼─────────────┐        ┌──────────────────┐
│  Next.js API routes          │──────▶│  lib/story-director│──▶ Anthropic Claude
│  app/api/**/route.ts         │        │  (tekst-AI)        │
│                               │        └──────────────────┘
│                               │        ┌──────────────────┐
│                               │──────▶│  lib/image.ts      │──▶ fal.ai (Nano Banana 2)
│                               │        │  (beeld-AI)        │
│                               │        └──────────────────┘
│                               │        ┌──────────────────┐
│                               │──────▶│  lib/storage.ts     │──▶ Supabase (Postgres)
└───────────────────────────────┘        └──────────────────┘
```

Server components (`app/page.tsx`, `app/verhaal/[id]/**/page.tsx`) lezen data rechtstreeks via
`lib/storage.ts` en renderen de pagina. Client components doen mutaties (een keuze maken, een
personage opslaan, een titel aanpassen) via `fetch()` naar de eigen API-routes, en roepen daarna
`router.refresh()` aan om de server-data opnieuw te tonen. Er is dus geen apart client-side
state-management (Redux/Zustand) nodig — de server is de bron van waarheid.

## 4. Datamodel (`lib/types.ts`)

Alles draait om drie kernbegrippen:

- **`Story`** — één boek: held, huidig personage-uiterlijk, de geheime verhaalbijbel, alle
  hoofdstukken, en metadata (titel, wie het maakte, favoriet, cover).
- **`Chapter`** — één hoofdstuk: leestekst (opgesplitst in ~3 "bladzijden"), de gemaakte keuze,
  de illustratie (of de status daarvan), en een paar interne velden voor de AI-beeldlogica.
- **`SavedCharacter`** — een held of nevenpersonage dat losstaat van één specifiek boek, in de
  "personagebibliotheek" van het kind, herbruikbaar over meerdere boeken heen.

```
Story
├── hero: { name, world, power, weakness, enemy, genre }        ← per-boek
│     power komt uit de skills van de held (als die er zijn), anders een genre-default
├── character: CharacterSheet                                   ← uiterlijk + stijl van de held, vast
│   ├── appearance.freeform  ← de GESCHREVEN ZIN is de baas (broek, schoenen, haar)
│   ├── appearance (ook hair/outfit/accessories/... als extra slot)
│   ├── imageStyleHint (hoort bij de HELD, niet bij één boek)
│   └── portraitUrl — PASPOORT: heel lijf, hoofd tot schoenen (UI snijdt bovenaan bij)
├── bible: StoryBible                                            ← GEHEIM, nooit aan het kind tonen
│   ├── aktes[5]  (heldenreis-structuur)
│   ├── openThreads[]
│   ├── worldAppearance (gestructureerd, vast decor)
│   ├── sideCharacters[] (naam + vaste zin + paspoort)
│   └── childOutline? (wat het kind zelf invulde: doel, boef, vrienden, vrije zin)
├── chapters: Chapter[]
│   ├── pages[]  (leestekst, meerdere "bladzijden" per hoofdstuk)
│   ├── choices[] (3 opties, leeg bij de finale)
│   ├── imageUrl / imagePending / imagePrompt
│   ├── sceneCharacterNames[] (wie in déze tekening hoort)
│   └── heroTemporaryAppearance? (alleen bij een tijdelijke vormverandering van de held)
├── authorName / authorAge                                       ← het ECHTE kind, niet de heldnaam
└── status: "bezig" | "klaar"

SavedCharacter (bibliotheek)
├── name, kind (hero|side), appearance, imageStyleHint, portraitUrl
└── skills?  ← optioneel: superkrachten; leeg = Claude mag per boek een default
```

**Identiteit is één slot voor iedereen** (`lib/character-identity.ts`): vaste naam, vaste zin,
één paspoort. Claude schrijft het verhaal. Code bepaalt wie hetzelfde wezen is. Een los
“jongetje” of “vriendje” naast een gekozen figuur wordt weggegooid. Staat een naam in de
tekst, dan gaat dat paspoort mee — ook als Claude de naam in `charactersInScene` vergeet.

Waarom **gestructureerde** velden én een vrije zin? De zin van het kind (`freeform`) is leidend
voor tekenen en controleren. Losse velden (`hair`, `outfit`, `accessories[]`) vangen details
die anders in één lange zin verdwijnen. Zie `lib/appearance.ts`.

## 5. De verhaal-engine (`lib/story-director.ts`)

Twee functies vormen het hart van de app:

- **`startStory(input)`** — schrijft hoofdstuk 1: verzint (of hergebruikt) het held-uiterlijk, de
  hele verhaalbijbel (5 aktes volgens de klassieke heldenreis), de openingsscène en de eerste
  3 keuzes.
- **`nextScene(input)`** — schrijft, op basis van de gemaakte keuze, de volgende scène: houdt
  personages/wereld/open draadjes consistent, stuurt het verhaal richting de juiste akte, en
  bepaalt of dit de finale is.

Beide roepen Claude aan via **tool-use** (`lib/ai/tools.ts`): Claude *moet* antwoorden met een
vast JSON-schema (geen vrije tekst), gestuurd door een uitgebreide systeemprompt
(`lib/ai/system-prompt.ts`) met 16 harde regels — o.a. foutloos Nederlands, nooit echt eng/
gewelddadig, exact 3 keuzes, en hoe uiterlijken/wereld/nevenpersonages consistent te houden.

**Leeftijd stuurt twee knoppen** (beide in `lib/story-director.ts`, meegegeven in elke
user-message naar Claude):

| Knop | Functie | Wat het doet |
|---|---|---|
| Leesniveau | `readingLevelLabel(age)` | Zinslengte en woorden per bladzijde (6-7 / 8-9 / 10+) — zie systeemregel 3. |
| Spanningsniveau | `tensionLevelLabel(age)` | Hoe de tegenstander en het einde zich mogen gedragen — zie systeemregel 2 + 8. |

Spanningsniveaus in het kort:
- **6-7 jaar** — tegenstander is vooral onhandig/eenzaam en draait om; niemand verliest echt iets;
  einde altijd warm en veilig.
- **8-9 jaar** — tegenstander mag oprecht dwars liggen; spanning mag oplopen; einde nog steeds warm.
- **10-11 jaar** — echte tegenslag mag (plan mislukt, vriendschap op de proef); tegenstander hoeft
  niet bekeerd te worden (mag ontsnappen of als dreiging blijven); einde mag bitterzoet; één klein
  draadje mag open blijven zolang de kernvraag beantwoord is. Verboden cliché: de slechterik
  “was alleen eenzaam” en wordt in de laatste scène vriend (dat is het 6-7-patroon).
  Regel 1 zegt bewust níet meer “altijd positief van toon” — die zin overschreef eerder de
  spanningsregel, waardoor zelfs 10+ nog zoet eindigde.

De **veiligheidsgrens** is voor alle leeftijden hetzelfde: geen wapens, bloed, horror of echte
pijn. Alleen de *emotionele* uitkomst wordt minder gegarandeerd zacht naarmate het kind ouder is.
(Feedback-aanleiding: een 11-jarige vond eindes te "zoetsappig" — de slechterik werd altijd goed.)

Pacing: het boek is gepland op **~14 hoofdstukken** (`CHAPTERS_TARGET` in `lib/progress.ts`,
gedeeld met de voortgangsbalk-UI). Vanaf hoofdstuk 12 dringt de prompt aan op afronden, met een
harde noodgrens (`HARD_CHAPTER_LIMIT = 18`) die altijd een finale afdwingt.

Twee-fase choice-flow (belangrijk voor de UX): een gekozen antwoord triggert eerst alleen
**tekstgeneratie** (fase A, `app/api/stories/[id]/choice/route.ts`) — dat is snel genoeg (~10-20s)
om synchroon op te wachten. Het **beeldwerk** (fase B) gebeurt daarna apart en asynchroon
(`app/api/stories/[id]/chapters/[n]/image/route.ts`), terwijl het kind al leest. De client
(`components/book-pager.tsx`) pollt dat endpoint elke 8s en bij het weer actief worden van het
tabblad, tot de tekening binnen is.

## 6. Beeldconsistentie (`lib/image.ts`) — de kern van "een goed kinderboek"

Puur tekst-naar-plaatje per illustratie is niet genoeg. Identiteit komt uit **drie dingen die
de code vasthoudt**, niet uit wat Claude per hoofdstuk opnieuw verzint:

1. **Paspoort (ankerbeeld).** Held: `character.portraitUrl`. Bijfiguur: `referenceImageUrl`
   (bibliotheek-portret, of één keer gemaakt bij eerste verschijning —
   `lib/side-character-images.ts`). Referenties zijn genummerd en gelabeld (plaat 1 = held,
   plaat 2 = bijfiguur). Alleen paspoorten. **Geen vorige scène** — die kopieerde houding en grot.
2. **Geschreven zin is de baas.** `appearance.freeform` (inclusief broek en schoenen) gaat
   letterlijk mee. Losse velden vullen aan. Claude mag een bekende appearance niet herschrijven
   (`lockCharacterRegistry`).
3. **Vision-check + 1 herkansing** op het leespad. `generateWithVerification` toetst of held én
   bijfiguren (én de gekozen actie) zichtbaar zijn. Mislukt het, dan één retry. Het verhaal
   stopt nooit: de beste poging wordt getoond.

**Paspoort = heel lijf** (`generatePortrait`, 3:4). Hoofd tot schoenen, rechtop, zachte
achtergrond. De ronde avatars op home snijden bovenaan bij (`object-top`). Een close-up of
“tot de knieën” liet het model broek en schoenen elke plaat opnieuw verzinnen.

**Tekenstijl hoort bij de held**, niet bij het boek (`imageStyleHint` op `SavedCharacter`).
Eén keer kiezen (nieuwe held: stap 4 van de wizard, of `/nieuw-personage`). Bestaande held:
geen stijltegel. Een bijfiguur uit een ander boek houdt z’n eigen paspoort, ook als de stijl
anders is — weggooien omdat de stijl niet matcht, liet het model een nieuw wezen verzinnen.

**De tekening moet de keuze laten zien.** `imagePrompt` beschrijft de actie (wie doet wat,
waar). Die zin staat vooraan in de beeldprompt. Identiteit erna. Claude mag geen herhaling
van dezelfde groepspose schrijven.

Wie in beeld hoort (`resolveLockedSceneCharacters`): Claude’s lijst **én** namen in de
bladzijden/tekenopdracht **én** gekozen bijfiguren in hoofdstuk 1. Alleen Claude vertrouwen
liet een gekozen figuur als “jongetje” tekenen.

Drie correcties die blijven:
- **Elk hoofdstuk een eigen plaatje.** `MAX_CONSECUTIVE_IMAGE_SKIPS = 0`.
- **Tijdelijke vormverandering.** `heroTemporaryAppearance` vervangt het normale slot en laat
  het held-paspoort weg, zodat de held niet twee keer in beeld komt.
- **Eerste plaat = kaft** van het boek (geen aparte cover-wachtpagina).

**Model & kosten.** `IMAGE_MODEL`/`IMAGE_EDIT_MODEL` staan op **`fal-ai/nano-banana-2`**.
Lite is bewust niet de default: slechtere identiteit. Daglimiet per kind via
`claim_image_quota` (§8). Kwaliteit weegt nu zwaarder dan een paar cent.

**Nog open:** de wereld heeft op het leespad geen ankerbeeld (alleen tekst;
`worldReferenceImageUrl` gaat als `null` mee). `generateWorldReferenceImage` bestaat voor
offline tests. Oude hoofdstuk-plaatjes worden niet herschreven.

## 7. Belangrijkste user flows

### Een nieuwe held maken (`app/nieuw-personage/page.tsx` → `components/new-character-form.tsx`)
Home “+” onder Andere helden opent **geen** nieuw verhaal, maar deze pagina:
1. Naam
2. Hoe ziet de held eruit? (deze zin blijft de baas)
3. Superkrachten of skills (mag leeg)
4. Tekenstijl — één keer, daarna vast

Portret wordt op de achtergrond gemaakt. Daarna terug naar home met die held actief.

### Een nieuw boek starten (`app/nieuw-verhaal/page.tsx` → `components/hero-form.tsx`)
- **Bestaande held:** 3 stappen (wie / waar + sfeer / start). Geen stijltegel — die hoort
  al bij de held. Optioneel bijfiguren meenemen. Optioneel hoofdlijn (doel, boef, vrienden).
- **Nieuwe held in de wizard:** 4 stappen; stap 4 is tekenstijl. Skills mag leeg.

Zwakte / vijand vraagt de UX niet meer; `lib/hero-defaults.ts` vult die per genre in.
Skills van de held winnen van die default (`POST /api/stories`). Daarna: `startStory`,
paspoort + openingsplaat op de achtergrond, boek opslaan.

### Lezen & kiezen (`app/verhaal/[id]/lezen/page.tsx`, `components/book-pager.tsx`)
1. Het kind bladert door de "bladzijden" van het huidige hoofdstuk (swipe/pijltjes/knoppen).
2. Op de laatste bladzijde: 3 keuzeknoppen (`components/choice-buttons.tsx`), of een eigen idee
   intypen.
3. `POST /api/stories/[id]/choice` (fase A, tekst) → direct leesbaar; op de achtergrond
   `POST /api/stories/[id]/chapters/[n]/image` (fase B, beeld) → verschijnt zodra klaar.
4. Onderweg: een held-/nevenpersonage kan met één tik bewaard worden in de bibliotheek
   (`components/save-character-button.tsx`, `components/side-character-saver.tsx`), en een
   nevenpersonage-suggestie kan permanent weggedrukt worden (`dismiss_side_character`-RPC).

### Terugbladeren (`app/verhaal/[id]/boek/page.tsx`)
Zelfde `BookPager`, maar dan read-only door een afgerond boek, met een link om verder te lezen
als het nog niet af is.

### De home — held-first (`app/page.tsx`, `components/home-hero-view.tsx`)
Nuvlo opent op de **actieve held**, niet op een boekenplank. Het kind ziet: groot portret + naam,
**Verder lezen** (of “Boek teruglezen”), **Nieuw avontuur**, en een rij om van held te wisselen
(of een nieuwe te maken). Daaronder staan alleen de boeken van díe held (`StoryCard`).

- **Held bewerken** via het potloodje: naam, uiterlijk, skills, leesniveau / leeftijd, of
  verwijderen. Wereld staat níet onder de heldennaam (die wisselt per boek).
- **“Verder lezen”** pakt via `continueStoryForHero` (`lib/hero-roster.ts`) het eerste open boek
  (`status === "bezig"`) van die held. De boekenlijst is gesorteerd op favoriet eerst, daarna
  `updated_at` (meest recent). Geen open boek → bovenste boek überhaupt (vaak “teruglezen”).
- **Held-wisselaar** (“Andere held”): op telefoon horizontaal scrollbaar; op groter scherm wrappen
  extra helden naar een tweede regel.
- Welke held actief is, onthoudt de browser in `localStorage` (`lib/active-hero.ts`); het
  helden-rooster komt uit opgeslagen helden + unieke held-namen in boeken (`lib/hero-roster.ts`).
- Per-boek-acties (titel, favoriet, delen, verwijderen) blijven in `components/story-card-menu.tsx`.

## 8. Database (Supabase / Postgres)

Vier tabellen in het `public`-schema, allemaal met **Row Level Security** aan:

| Tabel | Doel | Belangrijke kolommen |
|---|---|---|
| `children` | Eén rij per "profiel" (momenteel één gedeeld kind-profiel per installatie) | `id`, `name`, `age` |
| `stories` | Eén rij per boek | `child_id`, `title`, `hero`/`character`/`bible`/`chapters` (allemaal `jsonb`), `status`, `author_name`, `author_age`, `favorite`, `cover_url` |
| `characters` | Personagebibliotheek (held of bijfiguur) | `child_id`, `kind` (`hero`/`side`), `appearance` (`jsonb`), `portrait_url`, `image_style_hint`, `skills`, `source_story_ids[]` |
| `image_usage` | Dagelijkse beeld-quota per kind | `child_id`, `date`, `count` — primary key `(child_id, date)` |

De grote, groeiende structuren (`hero`, `character`, `bible`, `chapters`) zijn bewust `jsonb` in
plaats van eigen tabellen — het datamodel evolueert nog (zie `lib/types.ts`) en `jsonb` betekent
geen migratie nodig bij elk nieuw optioneel veld (zoals `heroTemporaryAppearance`).

**Postgres-functies (RPC's)**, gebruikt om race conditions op Vercel's serverless platform
onmogelijk te maken (twee gelijktijdige requests kunnen nooit dezelfde rij dubbel muteren):

- `append_chapter_atomic` — voeg een hoofdstuk toe, maar ALLEEN als het huidige laatste
  hoofdstuk nog geen keuze had (voorkomt een dubbel hoofdstuk bij een dubbele klik).
- `update_chapter_image_atomic` — schrijf een gegenereerde illustratie (+ evt. bijgewerkte
  `bible`) terug, alleen als dat hoofdstuk nog écht `imagePending` was.
- `claim_image_quota` / `release_image_quota` — atomaire increment-met-limiet-check voor de
  dagelijkse beeld-quota.
- `dismiss_side_character` — een nevenpersonage-suggestie permanent wegdrukken.
- `mark_portrait_seen` / `reveal_due_portrait` — de "uitgestelde beloning": een nieuw
  held-portret wordt pas de VOLGENDE sessie zichtbaar, met een eenmalig "kijk, hij is veranderd"
  onthulmoment.
- `register_story_for_character` — audit-trail: welke boeken hebben dit personage gebruikt.

Alle toegang loopt via `lib/storage.ts` (Supabase service-role key, server-only — nooit naar de
browser) en helpers als `lib/image-usage.ts` en `lib/side-character-images.ts`.

## 9. AI-integratie in detail

### Tekst — Anthropic Claude
- **Client**: `lib/ai/client.ts` (leest `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`).
- **Tool-schema's**: `lib/ai/tools.ts` — `START_STORY_TOOL` en `NEXT_SCENE_TOOL`, met
  genest-gestructureerde velden voor uiterlijk, wereld en nevenpersonages.
  Toolgebruik dwingt Claude tot geldige JSON, altijd voorspelbaar te verwerken.
- **Systeemprompt**: `lib/ai/system-prompt.ts` — harde regels (taal, veiligheid, leeslengte
  én spanningsniveau, cliffhangers, akte-pacing, open draadjes, kind-eigen invoer, identiteit
  van bekende figuren letterlijk kopiëren, actie in `imagePrompt`, exacte namen in
  `charactersInScene`). Spanningsniveau per leeftijd: `tensionLevelLabel` (§5).
- **Identiteit-slot**: `lib/character-identity.ts` — namen matchen (ook “Verity” =
  “Verity de vrolijke gele bal”), registry locken, wie in de tekening hoort.

### Beeld — fal.ai (Nano Banana 2)
- **Module**: `lib/image.ts` — alle generatie-functies (`generateSceneImage`, `generatePortrait`,
  `generateWorldReferenceImage`, `generateSideCharacterReferenceImage`, `generateCoverImage`).
- **Model-namespace-valkuil**: de "lite"-varianten zitten onder `google/`, niet `fal-ai/` — een
  fout hier faalt stil (geen enkele foutmelding aan het kind, gewoon geen plaatje). Zie de
  toelichting in `.env.example`.
- **`isLiteModel`-check**: lite-modellen ondersteunen geen `resolution`-parameter; die wordt
  conditioneel weggelaten in `buildFormatInput`.

## 10. Merk & look

Merkkleuren volgen het **wolk-boek-logo** (cream + diep teal):
- Teal primaire actiekleur ≈ `#185068` (`--primary` in `app/globals.css`)
- Cream achtergrond ≈ `#fdf3e7`
- Logo: `public/nuvlo-logo.png` (transparante achtergrond); app-iconen `app/icon.png`,
  `app/apple-icon.png`, `public/icon.png`; `theme_color` in `public/manifest.webmanifest`
  en `app/layout.tsx`.
- Licht = cream-lucht met zachte teal-gloed; donker = nachtelijke teal-hemel (geen paars/
  oranje meer als merkkleur). Favoriet-sterren mogen goud/amber blijven — dat is semantiek,
  geen merkaccent.

## 11. UX-principes die overal terugkomen

- **Nooit technisch jargon naar het kind.** Foutmeldingen worden altijd vertaald naar iets
  vriendelijks ("Het verhaal kon niet goed gemaakt worden. Probeer het nog eens.", nooit een
  stacktrace of statuscode).
- **Nooit blokkeren op een AI/beeld-fout.** Ontbreekt een illustratie, dan leest het kind gewoon
  door met een rustige placeholder (`components/illustration.tsx`) — het verhaal stopt nooit.
- **Stil herstel vóór een zichtbare foutmelding.** Zowel het ontbrekende-plaatje-herstel
  (elke 8s + bij tabblad-focus, `book-pager.tsx`) als het niet-willen-laden-van-een-plaatje
  (2x stille retry vóór een "Nog een keer!"-knop, `illustration.tsx`) volgen dit patroon.
- **Uitgestelde beloningen voelen echt.** Het held-portret update op vaste verhaalmomenten maar
  wordt pas de VOLGENDE sessie onthuld (`hasUnseenPortrait`/`reward-reveal`-animatie in
  `components/hero-panel.tsx`) — een reden om terug te komen, geen instant-gratificatie-loop.
- **De achtergrond is altijd de achtergrond, nooit een losse kaart.** Bewuste, herhaalde keuze
  (zie §12) om UI-elementen zoveel mogelijk direct op de paginakleur te laten staan i.p.v. in
  witte kaarten — en om `.night-sky` (het achtergrond-verloop) zowel op `<html>` als `<body>`
  te zetten zodat er op geen schermformaat een naad/wit vlak kan ontstaan.

## 12. Bekende afwegingen & valkuilen (voor toekomstig werk)

- **Eén gedeeld kind-profiel (nu).** `children`-tabel heeft momenteel effectief altijd maar één
  rij (`getDefaultChild`/`updateDefaultChild` in `lib/storage.ts`) — er is nog geen multi-kind-
  of login-systeem. `authorName`/`authorAge` per boek bestaan wél al los daarvan (zie §4).
  Het bedoelde model voor later staat in §13.
- **iOS Safari is een structurele aandachtspunt.** Cascade layers (`@layer`, Tailwind v4),
  `oklch`-kleuren en `background-attachment: fixed` gaven eerder concrete, zichtbare bugs op
  oudere iPads. `postcss-cascade-layers` en sRGB-fallbacks vangen dit nu op; puur `oklch` zonder
  fallback blijft een risico bij nieuwe kleuren.
- **Kosten vs. kwaliteit is een steeds terugkerende knop.** Beeldmodel (`IMAGE_MODEL`), of een
  illustratie hergebruikt wordt (`MAX_CONSECUTIVE_IMAGE_SKIPS`), en de vision-verify-retry
  (nu 1x op het leespad) zijn plekken waar bewust gekozen is voor kwaliteit. Dat kan bij
  schaal weer heroverwogen worden. Zie `.env.example`.
- **`jsonb`-double-encoding is een keer eerder misgegaan.** Bij een RPC-aanroep MOET een
  JS-object direct doorgegeven worden (niet `JSON.stringify`'d) — anders slaat Supabase een
  JSON-STRING op in plaats van een echt `jsonb`-object, wat later stille crashes gaf
  (`lib/storage.ts`, zie de `unpackJsonb`-defensieve laag als vangnet voor oudere, al-verkeerd
  opgeslagen rijen).
- **Alle Vercel-functies hebben `maxDuration = 60`** (Hobby-plan-maximum) op elke route die AI
  aanroept — zonder die regel kapt Vercel serverless functions na de standaard ~10s af.

## 13. Accounts, kind-profielen & gezin-abonnement (toekomst)

Nog **niet gebouwd**. Dit is het vaste productmodel voor wanneer Nuvlo accounts en betalen krijgt —
makkelijk voor kinderen, veilig voor ouders, eenvoudig te begrijpen.

### Hoofdregel

**De ouder logt in. Het kind tikt op zichzelf. Het gezin betaalt.**

Het kind heeft **geen e-mail** nodig en geen eigen account met wachtwoord.

### Rollen

| Wie | Wat |
|---|---|
| **Ouder** | Échte login (e-mail/wachtwoord, of Apple/Google). Instellingen, betalen, annuleren, toestemming voor delen. |
| **Kind-profiel** | Alleen kiezen via portret/naam op het startscherm. Eigen helden, boeken en leesniveau. Geen e-mail. |
| **Gezin** | Één abonnement (bv. Stripe) dat bij het ouder-account hoort, met ruimte voor meerdere kind-profielen. |

### Wat we bewust níet doen

- Kind-login met e-mail (veel kinderen hebben die niet; privacy/AVG-risico)
- Apart account of abonnement per kind (onnodig duur en complex)
- Apart account per held (helden horen onder een kind-profiel)
- Alleen “dit apparaat onthouden” zonder ouder-account (breekt bij nieuw apparaat en betalen)

### Veiligheid

- Geen openbare kind-profielen, geen vrije kind-kind-chat
- Delen alleen met oudertoestemming
- Zo min mogelijk persoonsgegevens van het kind
- Optioneel later: ouder-PIN om van kind-profiel te wisselen of instellingen te openen op een gedeelde iPad

### Bouwvolgorde (pas als product dit nodig heeft)

1. Ouder-auth (bijv. Supabase Auth) + één kind-profiel gekoppeld aan dat account  
2. Meerdere kind-profielen + wissel-scherm (“wie ben jij?”)  
3. Gezin-abonnement (Stripe) op het ouder-account  
4. Ouder-PIN / ouder-instellingen  

Tot die tijd blijft de app zoals nu: één gedeeld kind-profiel zonder login (zie §12).

## 14. Toekomstplan: Curiosity-Driven Reading

Product-richting (vastgelegd juli 2026): Nuvlo groeit langzaam uit tot een **curiosity-driven
reading platform**. De kern is niet "AI maakt een verhaaltje" maar: *kinderen gaan zélf lezen
omdat ze nieuwsgierig zijn hoe hun eigen avontuur verdergaat*. Eigenaarschap, cliffhangers,
keuzes, illustraties en terugkerende personages zijn middelen om dat te bereiken — geen doel op
zich.

**De ontwerpregel bij elke nieuwe feature:** *zorgt dit ervoor dat het kind méér zin krijgt om
zelf te lezen?* Nee → parkeren. (Dit is precies waarom het item-unlock-beloningssysteem eerder
is verwijderd, zie §12 — die vraag beantwoordde zichzelf met "nee".) Aanvullend: **Simple at
the front. Intelligent at the back.** — en past het in het levende universum van het kind
(§16), of is het een losse gadget?

**Positionering.** Nuvlo is *"a curiosity-driven reading app where children unlock their own
adventure by reading"* — kinderen lezen en bouwen zelfstandig. Niet een AI-bedtime-story-app,
geen voorleesapp, geen algemene story-generator, geen kinder-chatbot. Nuvlo praat nooit vrij
met het kind (er is geen vrije-tekst-naar-AI-pad; Claude antwoordt uitsluitend gestructureerd
via tool-use, zie §9) — het is een verhaalregisseur, geen chatbot.

**Het boek blijft eindig.** Geen oneindige feed: ~14 hoofdstukken, afronden vanaf hoofdstuk 12,
harde grens 18 (al zo geïmplementeerd, zie §5). De beloning is *"ik heb mijn eigen boek gelezen
en gemaakt"*, niet een oneindige stroom content.

**Roadmap-volgorde (bij twijfel wint de eerste, nog niet afgeronde stap):**
1. **Leeslus perfectioneren** ← huidige focus
2. Cliffhangers en keuzes verbeteren (deels gedaan; blijft tunen op echte verhalen)
3. ~~Tekstlengte/leeftijd afstemmen~~ — **gedaan** (leesniveau + spanningsniveau, zie §5); verder
   alleen nog finetunen op feedback van echte kinderen
4. Illustraties als beloning verfijnen
5. Afgerond boek/PDF/cover verbeteren
6. **Accounts + gezin-abonnement** (zie §13) — nodig vóór privé delen en betalen
7. Privé delen met familie (vereist §13)
8. Vriendjes veilig laten lezen/reageren (alleen veilige, vaste reacties — geen vrije chat)
9. Samen een boek maken (om de beurt lezen/kiezen, AI blijft regisseur)
10. Gecureerde openbare bibliotheek (alleen na goedkeuring, geen echte namen/foto's)
11. Schooldashboard (sober: gelezen hoofdstukken/minuten, geen ranglijsten of competitie)

**Al gedaan richting stap 1-3:**
- *Cliffhanger-/keuzekwaliteit aangescherpt* in `lib/ai/system-prompt.ts` (regels 4-5): concrete
  voorbeelden van goede cliffhangers (callback / zintuiglijke onthulling / gevolg van de eigen
  keuze) en van betekenisvolle keuzes (vertrouwen/moed/vriendschap raken) i.p.v. kale
  richting-keuzes — met expliciete tegenvoorbeelden, omdat een taalmodel concrete voorbeelden
  betrouwbaarder volgt dan abstracte woorden als "spannend".
- *Spanningsniveau per leeftijd* (`tensionLevelLabel` in `lib/story-director.ts` +
  systeemregels 2 en 8): 6-7 speels/veilig, 8-9 oplopende spanning, 10-11 echte tegenslag en
  bitterzoet einde toegestaan — veiligheidsgrens (geen geweld/bloed/echte pijn) blijft voor
  alle leeftijden gelijk. Aanleiding: feedback van een 11-jarige dat eindes te zoetsappig waren.
- *Home held-first* met actieve held, “Verder lezen”, held-wisselaar, en bewerken via potlood
  op het portret (`components/home-hero-view.tsx`, `lib/hero-roster.ts`).
- *Nieuw-verhaal-wizard* (`components/hero-form.tsx`): 3 stappen bij bestaande held, 4 bij
  nieuwe (stijl). Zwakte/vijand via `lib/hero-defaults.ts`. Skills optioneel op de held.
- *Nieuwe held-pagina* `/nieuw-personage` — home “+” opent die, niet een nieuw boek.
- *Tekenstijl vast op de held* (`lib/image-styles.ts`), niet per boek opnieuw.
- *Personage-slot* (`lib/character-identity.ts`): paspoort + geschreven zin voor iedereen;
  geen vorige scène als voorbeeld; gekozen bijfiguren mee in hoofdstuk 1.
- *Actie-eerst in de tekening*: de keuze moet zichtbaar zijn, niet dezelfde grot-pose.
- *Vision-check op het leespad* (1 herkansing) voor held, bijfiguren en actie.
- *Merk refresh*: cream + teal logo/thema (§10).
- *Minimale leessignaal-meting (v1)*: twee nieuwe kolommen op `stories`
  (`last_read_at`, `read_session_count`), bijgewerkt via de atomaire RPC `record_story_opened`
  en aangeroepen vanuit `components/book-pager.tsx` zodra de lees-/boekpagina opent
  (`POST /api/stories/[id]/opened`). Bewust "fire and forget": geen await, geen UI-effect, een
  mislukte aanroep wordt stil genegeerd — dit mag de leeservaring nooit vertragen of
  onderbreken. Geen externe analytics-dienst, geen extra persoonsgegevens; puur intern, in
  dezelfde Supabase-tabel. Dit is de kleinst mogelijke stap om straks de belangrijkste
  succesvraag te kunnen beantwoorden (zie hieronder) — een rijkere versie (sessie-lengte,
  bladzijdes per bezoek) kan later als een apart `reading_sessions`-tabelletje, maar is nu
  bewust nog niet gebouwd.

**Succesmeting.** De belangrijkste vraag is niet "hoeveel plaatjes/verhalen/kliks", maar: *pakt
een kind Nuvlo uit zichzelf weer op om verder te lezen?* `read_session_count`/`last_read_at`
(hierboven) is de eerste, kleine bouwsteen om dat ooit te kunnen beantwoorden — er is nog geen
dashboard of rapportage die dit toont, dat komt pas als er genoeg data is om iets van te leren.

**Veiligheidsprincipes die bij elke volgende stap gelden:** geen open internet/algemene chatbot
voor het kind, geen echte horror, geen publieke profielen of vrije kind-kind-chat in de vroege
fases, oudercontrole bij elke vorm van delen, zo min mogelijk persoonsgegevens, geen advertenties,
geen agressieve engagement-mechanics — nieuwsgierigheid en eigenaarschap mogen de motor zijn,
niet verslavende social mechanics. Zie ook §13 voor het account-/gezin-model.

## 15. Snel navigeren in de code

| Wil je... | Kijk in... |
|---|---|
| Hoe het verhaal geschreven wordt | `lib/story-director.ts`, `lib/ai/system-prompt.ts`, `lib/ai/tools.ts` |
| Hoe illustraties gegenereerd worden | `lib/image.ts`, `lib/side-character-images.ts`, `lib/ai/vision-verify.ts` |
| Wie hetzelfde wezen is | `lib/character-identity.ts`, `lib/appearance.ts` |
| Databasetoegang / RPC's | `lib/storage.ts`, `lib/image-usage.ts` |
| De leeservaring (bladeren, keuzes) | `components/book-pager.tsx`, `components/choice-buttons.tsx`, `components/illustration.tsx` |
| Boek aanmaken | `app/nieuw-verhaal/page.tsx`, `components/hero-form.tsx`, `app/api/stories/route.ts` |
| Personagebibliotheek | `lib/types.ts` (`SavedCharacter`), `app/api/characters/**`, `app/nieuw-personage/page.tsx`, `components/save-character-button.tsx` |
| Home / actieve held | `components/home-hero-view.tsx`, `lib/hero-roster.ts`, `lib/active-hero.ts` |
| Merk / thema / lettertype | `app/globals.css`, `app/layout.tsx`, `public/nuvlo-logo.png`, §10 hierboven |
| Eenmalige reparatie-/testscripts | `scripts/*.ts` (draaien via `NODE_OPTIONS="--conditions=react-server" npx tsx scripts/...`) |
| Leessignaal-meting / productrichting | `lib/storage.ts` (`recordStoryOpened`), `app/api/stories/[id]/opened/route.ts`, §14 hierboven |
| Accounts / gezin / abonnement (toekomst) | §13 hierboven |
| Lange-termijnvisie (universum) | §16 hierboven |

## 16. Lange-termijnvisie — The Nuvlo Universe

**Nog niet bouwen.** Wel beschrijven — zodat elke nieuwe feature getoetst kan worden aan:
*past dit in een levend universum van het kind, of is het een losse feature?*

### Wat het universum wél is

Elk kind bouwt langzaam een **persoonlijk universum**. Dat is geen spel en geen scorebord.
Het is een groeiend geheugen van alles wat het kind al lezend heeft gemaakt:

- helden  
- vrienden / nevenpersonages  
- werelden en plekken  
- boeken  
- relaties tussen die dingen  

Elk afgerond boek wordt deel van dat universum. Latere verhalen mogen die elementen
natuurlijk hergebruiken. De AI **verzint geen nieuw universum voor het kind** — de AI helpt
het universum van het kind groeien. Het kind blijft altijd de maker.

### Wat het níet mag voelen

- Geen punten, streaks of “verzamel alles”-gamification  
- Geen database-scherm (“personagebibliotheek” als kantoorterm)  
- Geen wereldkaart die je moet “unlocken” voordat je mag lezen  

Het moet voelen alsof Finn, zijn vrienden en zijn plekken gewoon *er zijn* — levend, niet als
rijen in een tabel.

### Taal naar het kind (later)

Kinderen denken niet: *“Ik ga naar mijn personagebibliotheek.”* Ze denken: *“Finn.”*
Daarom mag de huidige term **personagebibliotheek** (technische/code-naam, `SavedCharacter`)
uiteindelijk in de UI uitfaseren naar iets als **Mijn Wereld** — één plek waar helden,
vrienden, boeken en plekken samen leven. Geen herbouw van het datamodel; wél een
andere presentatie. Tot die tijd blijft de code-term “personagebibliotheek” / `characters`
gewoon bestaan (zie §4, §7).

### Toetsvraag bij elke feature

1. Helpt dit het kind **meer zelf te lezen**? (§14)  
2. Past dit in een **levend universum**, of is het een losse gadget? (deze §)  
3. Blijft de voorkant **simpel** terwijl de intelligentie achterin zit? (kopregel van dit document)

Als het antwoord bij 1 of 2 “nee” is → niet bouwen (of later opnieuw bekijken).

### Documentatie later opsplitsen (optioneel)

Deze blueprint groeit. Als AI-context te zwaar wordt, mag hij later gesplitst worden in
bijv. `PRODUCT_PHILOSOPHY.md`, `UX_GUIDELINES.md`, `AI_GUIDELINES.md`, `DATABASE.md`,
`IMAGE_ENGINE.md`, `ROADMAP.md` — met deze blueprint als naslagwerk. **Nog niet gedaan**;
één bron van waarheid is voor nu genoeg.

---
*Dit document is een momentopname (augustus 2026) en geen gegarandeerd actuele spec — bij
twijfel wint de code. Werk dit bestand bij zodra een architectuurkeuze structureel verandert.*
