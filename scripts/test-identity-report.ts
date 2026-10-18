// Controleert de identiteitsmeting zonder een tekening te maken.
// Een storing moet "unknown" zijn, niet "goed". De score mag geen herkansing starten.
//
//   npx tsx scripts/test-identity-report.ts

import {
  IDENTITY_CHECK_TRIGGERS_RETRY,
  buildIdentityPrompt,
  buildSceneIdentitySlots,
  enforceLookSources,
  finishIdentityReport,
  groundedInScene,
  identityStatusFromCharacters,
  normalizeVerdict,
  oppositeTraitConflict,
  parseIdentityResponse,
  type CharacterIdentityScore,
} from "@/lib/ai/identity-report";

function assert(ok: boolean, message: string) {
  if (!ok) {
    console.error("FOUT:", message);
    process.exitCode = 1;
  }
}

const slots = buildSceneIdentitySlots({
  heroPassportUrl: "https://example.test/held.png",
  compareHero: true,
  sidePassportUrls: ["https://example.test/side.png", null],
});

assert(IDENTITY_CHECK_TRIGGERS_RETRY === false, "de meting mag geen herkansing starten");
assert(slots.map((slot) => slot.slot).join() === "held,bijfiguur-1,bijfiguur-2", "held en elke bijfiguur apart");
assert(slots[2]?.passportUrl === null && slots[2]?.skipReason === "geen paspoort", "bijfiguur zonder paspoort wordt niet geraden");

const skippedHero = buildSceneIdentitySlots({
  heroPassportUrl: "https://example.test/held.png",
  compareHero: false,
  sidePassportUrls: [],
});
assert(
  skippedHero[0]?.skipReason === "tijdelijke vorm, paspoort niet vergeleken",
  "bij een tijdelijke vorm vergelijken we het normale paspoort niet",
);

const prompt = buildIdentityPrompt({
  action: "Pip zwaait",
  slots: ["held", "bijfiguur-1"],
  styleHint: "flat picture-book",
  sceneDescription: "Een meisje met lang blond haar en een paarse jurk.",
  passportDescriptions: [{ slot: "held", text: "Een jongen met donker haar, een rode pet en een blauwe jas." }],
});
assert(prompt.includes("gezichtsuitdrukking"), "een andere blik mag geen afkeuring zijn");
assert(prompt.includes("houding"), "een andere houding mag geen afkeuring zijn");
assert(prompt.includes("camerahoek"), "een andere camerahoek mag geen afkeuring zijn");
assert(prompt.includes("niet om dezelfde pixels"), "geen pixelvergelijking");
assert(prompt.includes("ELK personage apart"), "elk figuur apart beoordelen");
assert(prompt.includes("Neem de paspoortfiguur niet over"), "het paspoort mag niet als de nieuwe tekening worden beschreven");

assert(normalizeVerdict("passed", false) === "unknown", "tegenspraak wordt unknown");
assert(normalizeVerdict("failed", true) === "unknown", "tegenspraak wordt unknown");
assert(normalizeVerdict("passed", true) === "passed", "eensluidend goed blijft goed");
assert(normalizeVerdict("failed", false) === "failed", "eensluidend fout blijft fout");
assert(normalizeVerdict("onzin", null) === "unknown", "onbekende tekst wordt unknown");

const good = parseIdentityResponse(
  JSON.stringify({
    actionShown: false,
    styleMatches: false,
    characters: [
      { id: "held", verdict: "passed", sameCharacter: true, face: true, hair: true, body: true, clothes: true, style: true, note: "zelfde jongen" },
      { id: "bijfiguur-1", verdict: "passed", sameCharacter: true, face: true, hair: true, body: true, clothes: true, style: false, note: "zelfde robot" },
    ],
  }),
  slots,
);
assert(good.characters[0]?.verdict === "passed", "held goedgekeurd");
assert(good.characters[1]?.verdict === "passed", "bijfiguur goedgekeurd");
assert(good.characters[2]?.verdict === "unknown", "figuur zonder paspoort blijft unknown");
assert(good.actionShown === false, "actie blijft een aparte score");
assert(
  identityStatusFromCharacters(good.characters) === "unknown",
  "één unknown maakt het totaal unknown, niet goed",
);

const onlyChecked = good.characters.filter((character) => character.slot !== "bijfiguur-2");
assert(
  identityStatusFromCharacters(onlyChecked) === "passed",
  "stijl of actie keurt de identiteit niet af",
);

const failed = parseIdentityResponse(
  JSON.stringify({
    actionShown: true,
    styleMatches: true,
    characters: [
      { id: "held", verdict: "failed", sameCharacter: false, face: false, hair: false, body: false, clothes: false, style: true, note: "ander gezicht" },
      { id: "bijfiguur-1", verdict: "passed", sameCharacter: true, face: true, hair: true, body: true, clothes: true, style: true, note: "ok" },
    ],
  }),
  slots,
);
assert(identityStatusFromCharacters(failed.characters) === "failed", "één ander figuur keurt de identiteit af");

const broken = finishIdentityReport({
  slots,
  rawText: "geen json",
  model: "claude-haiku-4-5",
  durationMs: 12,
  inputTokens: null,
  outputTokens: null,
});
assert(broken.status === "unknown", "een kapot antwoord is unknown");
assert(broken.influencesRetry === false, "ook een kapot antwoord start geen tekening");
assert(broken.status !== ("passed" as CharacterIdentityScore["verdict"]), "een storing telt niet als geslaagd");

assert(
  oppositeTraitConflict(
    "een meisje met lang blond haar en een paarse jurk",
    "een jongen met donker haar, een rode pet en een blauwe jas",
  ) !== null,
  "een ander kind moet een tegenstelling zijn",
);
assert(
  oppositeTraitConflict(
    "een jongen met donker haar, rode pet en blauwe jas zwaait",
    "een jongen met donker haar, rode pet en blauwe jas staat stil",
  ) === null,
  "een andere houding is geen tegenstelling",
);
assert(
  oppositeTraitConflict("groene robot met een antenne", "blauwe robot op rupsbanden") !== null,
  "een andere robot moet een tegenstelling zijn",
);

const girl = enforceLookSources({
  sceneDescription: "een meisje met lang blond haar en een paarse jurk",
  passportDescriptions: { held: "een jongen met donker haar, een rode pet en een blauwe jas" },
  characters: [
    {
      slot: "held",
      verdict: "passed",
      sameCharacter: true,
      face: true,
      hair: true,
      body: true,
      clothes: true,
      style: true,
      note: "zelfde jongen",
      sceneLook: "jongen met rode pet en blauwe jas",
      passportLook: "jongen met rode pet en blauwe jas",
    },
  ],
});
assert(girl[0]?.verdict === "failed", "een blond meisje mag niet als de jongen worden goedgekeurd");
assert(
  groundedInScene("jongen met rode pet en blauwe jas", "een meisje met lang blond haar en een paarse jurk") === false,
  "een overgeschreven paspoort telt niet als beschrijving van de nieuwe tekening",
);

const sameBoy = enforceLookSources({
  sceneDescription: "een jongen met donker haar, rode pet en blauwe jas zwaait in het park",
  passportDescriptions: { held: "een jongen met donker haar, rode pet en blauwe jas" },
  characters: [
    {
      slot: "held",
      verdict: "passed",
      sameCharacter: true,
      face: true,
      hair: true,
      body: true,
      clothes: true,
      style: true,
      note: "zelfde jongen",
      sceneLook: "jongen met donker haar, rode pet en blauwe jas",
      passportLook: "jongen met donker haar, rode pet en blauwe jas",
    },
  ],
});
assert(sameBoy[0]?.verdict === "passed", "hetzelfde kind in een andere houding blijft goedgekeurd");

if (process.exitCode) {
  console.error("Identiteitsmeting-tests gefaald.");
} else {
  console.log("Identiteitsmeting-tests geslaagd.");
}
