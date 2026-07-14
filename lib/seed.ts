// Eén hardcoded voorbeeldverhaal, zodat de UI meteen iets te tonen heeft zonder AI-calls.
// Dit wordt alleen gebruikt om data/stories.json de allereerste keer te vullen.

import type { Child, Story } from "@/lib/types";

export const SEED_CHILD: Child = {
  id: "kind-1",
  name: "Lezer",
  age: 8,
};

export const SEED_STORIES: Story[] = [
  {
    id: "voorbeeld-verhaal-1",
    childId: SEED_CHILD.id,
    title: "Finn en het geheim van Sterrenwoud",
    authorName: SEED_CHILD.name,
    authorAge: SEED_CHILD.age,
    hero: {
      name: "Finn",
      world: "Sterrenwoud",
      power: "praten met dieren",
      weakness: "bang zijn in het donker",
      enemy: "de Schaduwwolf",
      genre: "fantasie",
    },
    character: {
      appearance: {
        freeform:
          "vlammend rood haar, sproeten, een groene cape met gouden rand en stevige bruine laarzen",
        hair: "vlammend rood haar",
        outfit: "een groene cape met gouden rand en stevige bruine laarzen",
        accessories: ["een groene cape met gouden rand"],
        companion: "",
        skinOrFurTone: "sproeten",
        distinguishingFeature: "een groene cape met gouden rand",
      },
      imageStyleHint: "flat colorful 2D children's picture-book illustration style",
      items: ["een glimmende sterrenspeld"],
      portraitUrl: null,
      pendingPortraitUrl: null,
    },
    bible: {
      aktes: [
        "Akte 1 — Kennismaking: Finn leeft rustig in Sterrenwoud, tot de Schaduwwolf wakker wordt.",
        "Akte 2 — De reis begint: Finn ontmoet Vonk, het kleine drakenjong.",
        "Akte 3 — Het keerpunt: de Schaduwwolf slaat harder terug.",
        "Akte 4 — De grote krachtsmeting: Finn bereidt zich voor met Vonk.",
        "Akte 5 — De afsluiting: Finn overwint met praten-met-dieren. Warm einde.",
      ],
      openThreads: [],
      worldAppearance: {
        freeform:
          "Een betoverd sterrenbos met hoge, glinsterende bomen, zachte blauwe en paarse gloed, en overal kleine ronddwarrelende lichtjes.",
        setting: "een betoverd sterrenbos",
        paletteAndAtmosphere: "zachte blauwe en paarse gloed, kleine ronddwarrelende lichtjes",
        landmark: "hoge, glinsterende bomen",
      },
      worldReferenceImageUrl: null,
      sideCharacters: [
        {
          name: "Vonk",
          appearance: {
            freeform: "een klein drakenjong met glimmende groene schubben, grote gele ogen en kleine gouden vleugels",
            distinguishingFeature: "kleine gouden vleugels",
          },
          referenceImageUrl: null,
        },
      ],
    },
    summary:
      "Finn overwon de Schaduwwolf met de hulp van Vonk het drakenjong, en Sterrenwoud is weer veilig.",
    status: "klaar",
    coverUrl: null,
    favorite: false,
    chapters: [
      {
        n: 1,
        pages: ["Finn woont in Sterrenwoud. Het is een fijne plek, met hoge bomen en een heldere sterrenhemel. Elke avond is het er lekker rustig. Maar vanavond is alles anders. Er klinkt een vreemd geluid tussen de bomen. \"Hoorde je dat?\" vraagt Finn zachtjes. Niemand antwoordt. Het geluid komt dichterbij. Plots springt er iets uit de struiken. Het is Vonk, het kleine drakenjong! Vonk kijkt bang om zich heen. \"Snel, verstop je!\" piept Vonk. \"De Schaduwwolf is wakker geworden!\" Finn schrikt enorm en voelt de kracht van praten-met-dieren vanbinnen kriebelen. Die kracht kan nu misschien helpen. Maar durft Finn het wel te gebruiken?"],
        choices: [],
        chosen: "A. Finn gebruikt meteen zijn kracht om Vonk te helpen.",
        imagePrompt:
          "Vrolijke kinderboek-illustratie: Finn ontmoet Vonk 's avonds in Sterrenwoud, sterrenhemel op de achtergrond.",
        imageUrl: null,
      },
      {
        n: 2,
        pages: ["Finn praat zachtjes met de dieren van het bos, één voor één. Ze vertellen allemaal hetzelfde verhaal: de Schaduwwolf zoekt een gouden ster die diep in het woud verstopt ligt. \"Als hij die vindt, wordt hij nog machtiger,\" zegt Vonk bezorgd, terwijl hij dicht tegen Finn aan kruipt. Samen besluiten Finn en Vonk om de ster eerst te vinden. Ze lopen dieper het woud in. De bomen worden hoger en de schaduwen langer. Het is stil, heel stil. Ineens hoort Finn iets grommen, vlakbij tussen de struiken..."],
        choices: [],
        chosen: "A. Finn rent samen met Vonk op het geluid af.",
        imagePrompt: "Finn en Vonk lopen door een donker, mysterieus bos, vrolijke stijl.",
        imageUrl: null,
      },
      {
        n: 3,
        pages: ["Het gegrom komt niet van de Schaduwwolf, maar van een klein, verdwaald egeltje dat vast zit tussen de wortels van een oude boom. Finn praat rustig en geduldig met het egeltje, tot het eindelijk los komt. Opgelucht bedankt het egeltje Finn en vertelt een groot geheim: de gouden ster ligt verstopt in de Holle Boom, niet ver hiervandaan. Maar net op dat moment verschijnt de Schaduwwolf tussen de bomen, met ogen die fonkelen in het donker. \"Die ster is van mij!\" gromt hij dreigend, en hij komt langzaam dichterbij."],
        choices: [],
        chosen: "B. Finn gebruikt zijn kracht om zich te verstoppen en af te wachten.",
        imagePrompt: "De Schaduwwolf verschijnt tussen de bomen, spannend maar niet eng, kinderboekstijl.",
        imageUrl: null,
      },
      {
        n: 4,
        pages: ["Finn en Vonk verstoppen zich muisstil achter een dikke boomstam. De Schaduwwolf snuffelt luid rond, op zoek naar een spoor. Maar dankzij de dieren van het bos, die overal op de uitkijk staan en zachtjes signalen doorgeven, verklapt niemand waar Finn zich verstopt. Na een lange, spannende stilte loopt de Schaduwwolf eindelijk grommend weg. Zodra hij verdwenen is, rennen Finn en Vonk zo snel als ze kunnen naar de Holle Boom. Daar, diep in de schors, gloeit de gouden ster zachtjes op. Nu is het tijd voor het echte plan."],
        choices: [],
        chosen: "A. Finn rent samen met Vonk naar de Holle Boom.",
        imagePrompt: "Finn en Vonk vinden een gloeiende gouden ster in een holle boom, warme lichtjes.",
        imageUrl: null,
      },
      {
        n: 5,
        pages: ["Met de gouden ster voorzichtig in zijn handen roept Finn alle dieren van Sterrenwoud bij elkaar, van de kleinste muis tot het grootste hert. Samen vormen ze een warme, grote cirkel op de plek waar de Schaduwwolf zal verschijnen. \"Je hoeft niet meer bang te zijn in het donker,\" zegt Finn zachtjes tegen zichzelf, en voor het eerst voelt hij zich echt sterk. Vonk knijpt geruststellend in zijn hand. Finn houdt de ster hoog boven zijn hoofd. Het licht wordt steller en steller, tot het bijna verblindend fel schijnt..."],
        choices: [],
        chosen: "A. Finn gebruikt zijn kracht om alle dieren te verzamelen.",
        imagePrompt: "Finn omringd door bosdieren, houdt een gouden ster omhoog, magisch licht, kinderboekstijl.",
        imageUrl: null,
      },
      {
        n: 6,
        pages: ["Het is voorbij! Het warme licht van de gouden ster verandert de Schaduwwolf in een gewone, vriendelijke wolf, die eigenlijk altijd al bang was in het donker — net als Finn zelf ooit was. Samen begrijpen ze elkaar nu heel goed, en de wolf buigt dankbaar zijn kop. Vonk maakt een uitgebreid vreugdedansje van blijdschap. Alle dieren van het bos komen dichterbij om mee te vieren. Sterrenwoud is weer veilig en rustig, misschien wel veiliger dan ooit. Finn kijkt omhoog naar de sterren en glimlacht breed. Wat een avontuur was dit."],
        choices: [],
        chosen: null,
        imagePrompt: "Vrolijk feest onder een sterrenhemel: Finn, Vonk en de wolf zijn nu vrienden.",
        imageUrl: null,
      },
    ],
    createdAt: new Date("2026-07-01T20:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-07-01T20:30:00.000Z").toISOString(),
  },
];
