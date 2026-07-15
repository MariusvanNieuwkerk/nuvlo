// Tool-schema's voor Anthropic's tool-use. Door Claude te dwingen te antwoorden via een
// tool met een vast schema, krijgen we betrouwbaar geldige JSON terug — geen losse tekst
// die we zelf moeten parsen en die soms mislukt.
//
// characterAppearance/worldAppearance/sideCharacters zijn GESTRUCTUREERDE objecten, geen
// vrije zinnen — dat is de eigenlijke oorzaak-fix voor details die eerder wegvielen (zoals
// een gevraagd petje dat niet getekend werd). Zie lib/appearance.ts voor de volledige
// uitleg: door Claude te dwingen elk visueel kenmerk in zijn EIGEN veld te zetten (in
// plaats van in één lange zin), kan niets meer stilletjes tussen de regels verdwijnen —
// noch bij Claude's eigen herhaling ervan, noch bij de prompt-opbouw in lib/image.ts.
import type Anthropic from "@anthropic-ai/sdk";

const CHARACTER_APPEARANCE_SCHEMA = {
  type: "object" as const,
  properties: {
    freeform: {
      type: "string",
      description:
        "Een opgeschoonde, volledige, beeldende uiterlijk-zin (Nederlands), gebaseerd op wat het kind zelf aangaf. Herschrijf onduidelijke, ongepaste of vreemde stukjes rustig naar iets vriendelijks en kindvriendelijks. Wordt gebruikt voor weergave en als basis-beschrijving.",
    },
    hair: { type: "string", description: "Haarkleur/-vorm, Nederlands. Leeg als niet van toepassing." },
    outfit: { type: "string", description: "Kleding en kleuren, Nederlands." },
    accessories: {
      type: "array",
      items: { type: "string" },
      description:
        "ELK los accessoire of kledingdetail als apart item (bv. 'een petje achterstevoren op zijn hoofd', 'een rode cape'). Dit is HET veld waar concrete details eerder verdwenen doordat ze verstopt zaten in één lange zin — wees hier expliciet en volledig, mis niets dat het kind noemde.",
    },
    companion: {
      type: "string",
      description: "Een vast huisdier/sidekick dat het kind noemde en dat altijd meegetekend moet worden. Lege string als er geen is.",
    },
    skinOrFurTone: { type: "string", description: "Huid- of vachtkleur, Nederlands. Leeg als niet van toepassing." },
    distinguishingFeature: {
      type: "string",
      description:
        "HET ENE meest kenmerkende, unieke visuele detail van deze held (vaak hetzelfde als het belangrijkste accessoire) — dit veld wordt in elke illustratie-prompt herhaald als harde eis en apart gecontroleerd, dus kies het detail dat het meest opvalt en het minst mag ontbreken.",
    },
  },
  required: ["freeform", "hair", "outfit", "accessories", "companion", "skinOrFurTone", "distinguishingFeature"],
};

const WORLD_APPEARANCE_SCHEMA = {
  type: "object" as const,
  properties: {
    freeform: {
      type: "string",
      description:
        "VERPLICHT, nooit leeg: een volledige, vloeiende Nederlandse zin die setting, paletteAndAtmosphere en landmark hieronder samenvat tot één leesbare beschrijving (geen personages/namen). Verandert NOOIT meer gedurende het hele verhaal.",
    },
    setting: { type: "string", description: "Kort, het TYPE omgeving (bv. 'een eindeloze sterrenhemel', 'een onderwaterstad')." },
    paletteAndAtmosphere: { type: "string", description: "Kleurenpalet en sfeer, Nederlands." },
    landmark: {
      type: "string",
      description:
        "ÉÉN opvallend, concreet en makkelijk tekenbaar herkenningspunt van deze wereld (bv. 'een gigantische glazen toren', 'zwevende gouden eilandjes') dat in illustraties mag terugkomen als visueel anker voor de omgeving — geen vage sfeer, maar iets tastbaars.",
    },
  },
  required: ["freeform", "setting", "paletteAndAtmosphere", "landmark"],
};

const SIDE_CHARACTERS_SCHEMA = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Vaste naam van het nevenpersonage." },
      appearance: {
        type: "object" as const,
        properties: {
          freeform: { type: "string", description: "Beeldende, vaste uiterlijk-beschrijving (kleur, vorm, kleding) — Nederlands." },
          distinguishingFeature: {
            type: "string",
            description: "Het ene meest kenmerkende visuele detail van dit nevenpersonage, dat het herkenbaar houdt tussen platen.",
          },
        },
        required: ["freeform", "distinguishingFeature"],
      },
    },
    required: ["name", "appearance"],
  },
  description:
    "Nevenpersonages die al een duidelijk, tekenbaar uiterlijk hebben (bv. een pratend dier, een robot-hulpje) — geef ze een vaste naam en gestructureerd uiterlijk, zodat ze er in latere illustraties consistent uitzien. Leeg als er nog geen nevenpersonage met een duidelijk uiterlijk voorkomt.",
};

// Zelfde vorm als SIDE_CHARACTERS_SCHEMA, maar met een andere beschrijving die aandringt op
// het EXACT overnemen van bestaande personages — nodig zodra er al bekende nevenpersonages
// bestaan (vanaf hoofdstuk 2), anders kan een uiterlijk tussen platen toch verschuiven.
const SIDE_CHARACTERS_SCHEMA_FOR_UPDATE = {
  ...SIDE_CHARACTERS_SCHEMA,
  description:
    "De VOLLEDIGE, bijgewerkte lijst van bekende nevenpersonages. Bestaande personages (zie 'Bekende nevenpersonages' in het bericht): kopieer hun naam en gestructureerde uiterlijk EXACT over, verander nooit een bestaand uiterlijk — anders klopt de nieuwe illustratie niet meer met eerdere platen. Komt er in deze scène een NIEUW nevenpersonage met een duidelijk, tekenbaar uiterlijk bij? Voeg dat toe met een vaste naam en gestructureerd uiterlijk.",
};

// Optioneel veld, alleen gevuld als de held er in DEZE ene scène ECHT fysiek anders uitziet
// dan normaal (getransformeerd/gekrompen/veranderd in een dier/betoverd). Zonder dit veld
// dwong lib/image.ts elke illustratie om het vaste, normale uiterlijk te tekenen, ook als de
// scènetekst een transformatie beschreef — met als gevolg dat de held soms TWEE keer in
// beeld kwam (de normale vorm ÉN de nieuwe vorm, als los personage naast elkaar). Zie ook
// Chapter.heroTemporaryAppearance in lib/types.ts en generateSceneImage in lib/image.ts.
const HERO_TEMPORARY_APPEARANCE_SCHEMA = {
  type: "string" as const,
  description:
    "Vul dit VEEL vaker leeg dan gevuld — alleen invullen als de held er in DEZE ene scène ECHT fysiek anders uitziet dan normaal: bv. tijdelijk gekrompen tot muisformaat, veranderd in een dier, onzichtbaar, betoverd tot een ander wezen. Een gewoon kostuum, jas, helm of vermomming AANTREKKEN is GEEN echte vormverandering — dan blijft dit veld leeg. Is er wel een echte vormverandering, beschrijf dan kort en beeldend hoe de held er NU uitziet (bv. 'een klein bruin muisje, met nog steeds de rode sjaal om'). BELANGRIJK: dit vervangt het normale uiterlijk voor deze ene illustratie volledig — de held mag dus NOOIT tegelijk in zijn gewone vorm ÉN deze nieuwe vorm te zien zijn, dat zijn geen twee wezens maar hetzelfde personage.",
};

export const START_STORY_TOOL: Anthropic.Tool = {
  name: "verhaal_starten",
  description:
    "Sla de start van een nieuw kinderverhaal op: titel, verborgen verhaalbijbel, openingsscène en keuzes.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Een korte, spannende titel voor het verhaal (max. 8 woorden).",
      },
      aktes: {
        type: "array",
        items: { type: "string" },
        minItems: 5,
        maxItems: 5,
        description:
          "Precies 5 aktes volgens de klassieke heldenreis, geschreven als korte beschrijving per akte, toegespitst op deze held, wereld en tegenstander.",
      },
      openThreads: {
        type: "array",
        items: { type: "string" },
        description: "Losse verhaaldraadjes die later in het verhaal kunnen terugkomen.",
      },
      summary: {
        type: "string",
        description: "Korte lopende samenvatting van het verhaal tot nu toe (max. 40 woorden).",
      },
      characterAppearance: CHARACTER_APPEARANCE_SCHEMA,
      imageStyleHint: {
        type: "string",
        description:
          "Een korte kunststijl-aanwijzing IN HET ENGELS voor de illustratie-AI, gebaseerd op characterAppearance. Herkent het uiterlijk een bekende spel- of tekenstijl (bijv. blokkerig/pixelig zoals Minecraft of Roblox, of anime met grote glinsterende ogen)? Maak dat dan EXPLICIET en OVERDREVEN duidelijk, met concrete Engelse vaktermen, bijvoorbeeld: 'Minecraft voxel art style, blocky cubic shapes, sharp 90-degree edges, NOT round, NOT smooth' of 'anime style, big sparkly eyes, vibrant spiky hair, cel-shaded'. Is er niks bijzonders beschreven, gebruik dan: 'flat colorful 2D children's picture-book illustration style'. Altijd 1-2 zinnen, altijd Engels (beeldmodellen volgen Engelse stijltermen veel beter dan Nederlandse).",
      },
      pages: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
        description:
          "De openingsscène opgesplitst in ongeveer 3 leesbladzijden (elk item = één bladzijde). Elke bladzijde is een afgeronde kleine verhaalbeat met wat dialoog; splits op natuurlijke momenten. De LENGTE per bladzijde schaalt met de leeftijd (zie systeemregel 3). De LAATSTE bladzijde eindigt op een spannende cliffhanger, vlak vóór de keuzes.",
      },
      choices: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
        description:
          "Precies drie keuzes (zonder A/B/C-voorvoegsel) die alleen te maken zijn als je de hele scène gelezen hebt.",
      },
      imagePrompt: {
        type: "string",
        description:
          "Beeldende beschrijving voor een vrolijke, niet-enge kinderboek-illustratie van ÉÉN stilstaand moment uit pages[0] hierboven (de EERSTE bladzijde — daar wordt de illustratie getoond, dus ze moeten bij elkaar passen). Kies het meest tekenbare, spannende moment van die ene bladzijde en beschrijf ALLEEN dat: WAT gebeurt er precies op dat moment, WAAR, welke actie/houding. VERBODEN: twee of meer momenten/gebeurtenissen samenvoegen in één beschrijving (bv. 'eerst X, en daarna/in de volgende scène Y') — een illustratie kan maar één bevroren moment tonen; het samenvoegen van meerdere momenten levert een verwarrend plaatje op dat bij geen van beide momenten goed past. De illustratie-code voegt het exacte uiterlijk van de held en de wereld er zelf al aan toe (niet zelf herhalen), focus dus op de scène-specifieke inhoud van dat ene moment.",
      },
      heroTemporaryAppearance: HERO_TEMPORARY_APPEARANCE_SCHEMA,
      worldAppearance: WORLD_APPEARANCE_SCHEMA,
      sideCharacters: SIDE_CHARACTERS_SCHEMA,
      charactersInScene: {
        type: "array",
        items: { type: "string" },
        description:
          "Namen (exact zoals in sideCharacters) van nevenpersonages die echt te ZIEN zijn in de illustratie van deze scène. Leeg als alleen de held te zien is.",
      },
    },
    required: [
      "title",
      "aktes",
      "openThreads",
      "summary",
      "characterAppearance",
      "imageStyleHint",
      "pages",
      "choices",
      "imagePrompt",
      "worldAppearance",
      "sideCharacters",
      "charactersInScene",
    ],
  },
};

export const NEXT_SCENE_TOOL: Anthropic.Tool = {
  name: "volgende_scene",
  description:
    "Sla de volgende scène van het verhaal op, gebaseerd op de keuze die het kind net maakte.",
  input_schema: {
    type: "object",
    properties: {
      pages: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
        description:
          "De nieuwe scène opgesplitst in ongeveer 3 leesbladzijden (elk item = één bladzijde). Verwerkt de gemaakte keuze zichtbaar op de eerste bladzijde. Elke bladzijde is een afgeronde kleine verhaalbeat met wat dialoog; splits op natuurlijke momenten. De lengte per bladzijde schaalt met de leeftijd (zie systeemregel 3). De LAATSTE bladzijde eindigt op een cliffhanger, TENZIJ isFinale true is — dan eindigt de laatste bladzijde juist warm en afgerond, zonder cliffhanger.",
      },
      choices: {
        type: "array",
        items: { type: "string" },
        description:
          "Precies drie nieuwe keuzes (zonder A/B/C-voorvoegsel), of een LEGE lijst als isFinale true is.",
      },
      summary: {
        type: "string",
        description: "Bijgewerkte lopende samenvatting van het hele verhaal (max. 80 woorden).",
      },
      openThreads: {
        type: "array",
        items: { type: "string" },
        description: "Bijgewerkte lijst van open verhaaldraadjes (nieuwe toegevoegd, afgeronde verwijderd).",
      },
      imagePrompt: {
        type: "string",
        description:
          "Beeldende beschrijving voor een vrolijke, niet-enge kinderboek-illustratie van ÉÉN stilstaand moment uit pages[0] hierboven (de EERSTE bladzijde — daar wordt de illustratie getoond, dus ze moeten bij elkaar passen). Kies het meest tekenbare, spannende moment van die ene bladzijde en beschrijf ALLEEN dat: WAT gebeurt er precies op dat moment, WAAR, welke actie/houding/nieuwe omgevingsdetails. VERBODEN: twee of meer momenten/gebeurtenissen samenvoegen in één beschrijving (bv. 'eerst X, en daarna/in de volgende scène Y') — een illustratie kan maar één bevroren moment tonen; het samenvoegen van meerdere momenten levert een verwarrend plaatje op dat bij geen van beide momenten goed past. Het exacte uiterlijk van de held en de wereld voegt de illustratie-code er zelf al aan toe (niet zelf herhalen), focus dus op wat er op dat ene moment specifiek gebeurt.",
      },
      isFinale: {
        type: "boolean",
        description: "True als dit de laatste scène van het verhaal is (warm einde, geen cliffhanger).",
      },
      visuallyDistinctFromPrevious: {
        type: "boolean",
        description:
          "True als deze scène er visueel duidelijk ANDERS uitziet dan de vorige illustratie: een nieuwe locatie/omgeving, een nieuwe grote actie of houding, een dramatisch nieuw object of personage dat de scène binnenkomt, of een groot keerpunt. False als de scène in dezelfde plek blijft en gewoon hetzelfde moment voortzet als het vorige hoofdstuk (bv. nog steeds door dezelfde sterrentunnel vliegen, alleen een stukje verder). Bepaalt of er een nieuwe, betaalde illustratie gemaakt wordt of dat het vorige plaatje hergebruikt wordt — wees hier eerlijk, niet standaard 'true'.",
      },
      newLocation: {
        type: "boolean",
        description:
          "True ALLEEN als het verhaal in deze scène naar een WEZENLIJK andere plek verhuist, zo anders dat het bestaande wereld-decor niet meer klopt (bv. van de open sterrenhemel naar de binnenkant van een donkere grot, of van een bos naar een onderwaterpaleis). False bij een gewone verplaatsing binnen dezelfde omgeving (een stukje verder vliegen, een andere hoek van dezelfde plek). Dit is zeldzaam en kost een extra illustratie — wees streng, meestal false.",
      },
      newLocationAppearance: {
        ...WORLD_APPEARANCE_SCHEMA,
        description:
          "ALLEEN invullen als newLocation true is: de gestructureerde spec (freeform + setting + paletteAndAtmosphere + landmark) van de NIEUWE plek waar de scène zich nu afspeelt. Laat leeg/weg als newLocation false is.",
      },
      heroTemporaryAppearance: HERO_TEMPORARY_APPEARANCE_SCHEMA,
      sideCharacters: SIDE_CHARACTERS_SCHEMA_FOR_UPDATE,
      charactersInScene: {
        type: "array",
        items: { type: "string" },
        description:
          "Namen (exact zoals in sideCharacters) van nevenpersonages die echt te ZIEN zijn in de illustratie van deze scène. Leeg als alleen de held te zien is.",
      },
    },
    required: [
      "pages",
      "choices",
      "summary",
      "openThreads",
      "imagePrompt",
      "isFinale",
      "visuallyDistinctFromPrevious",
      "sideCharacters",
      "charactersInScene",
    ],
  },
};
