const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Tailwind v4 verpakt ALLE regels (base + utilities + thema) in CSS "cascade layers"
    // (@layer). Safari ouder dan 15.4 (o.a. oudere iPads) kent @layer niet en gooit dan
    // het HELE stylesheet weg — dan toont de app alleen de kale HTML (enkel de omslag-
    // afbeelding + wit). Deze plugin "plat" de layers na de build, zodat de stijlen ook
    // op oude WebKit gewoon toegepast worden. Op moderne browsers verandert er niets.
    "@csstools/postcss-cascade-layers": {},
  },
};

export default config;
