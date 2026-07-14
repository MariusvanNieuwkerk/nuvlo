// In-process, per-sleutel async mutex (grendel). Fase 1: er is nog geen echte database met
// transacties, en de hele app draait als één Node-proces. Dat maakt een read-modify-write op
// data/stories.json kwetsbaar voor races: twee gelijktijdige aanvragen voor hetzelfde verhaal
// lezen allebei dezelfde staat in, doen allebei hun mutatie en schrijven allebei terug — de
// een overschrijft de ander, of (erger) allebei voegen een hoofdstuk toe → een dubbel hoofdstuk.
//
// Deze grendel serialiseert de kritieke sectie PER verhaal-id: aanvraag B voor verhaal X wacht
// netjes tot aanvraag A voor verhaal X klaar is, terwijl aanvragen voor een ánder verhaal Y
// gewoon parallel doorlopen. We ketenen daarvoor per sleutel een promise-keten.
//
// TRADE-OFF (bewust): dit werkt alleen binnen één proces. Zodra we naar Supabase/Postgres gaan
// (of meerdere server-instanties draaien) moet de echte bescherming van de database komen —
// een transactie of een optimistische versie-check (updatedAt/version). Voor de huidige
// single-process opzet mét het efemere-bestandssysteem is een in-process grendel de robuustste
// oplossing die we cleanly kunnen bouwen, en hij lost bovendien de eerder gesignaleerde
// storage-race op die tijdens gelijktijdig testen quota verbrandde.

// Per sleutel houden we de "staart" van de wachtrij bij: een promise die pas resolvet als het
// laatst ingeplande werk voor die sleutel klaar is. Nieuwe aanvragen haken daarachter aan.
const tails = new Map<string, Promise<unknown>>();

// Voert `fn` uit met exclusieve toegang voor deze `key`. Wacht op de vorige aanvraag voor
// dezelfde sleutel (ongeacht of die slaagde of faalde — anders zou één fout de grendel voor
// altijd blokkeren), en ruimt de sleutel weer op zodra de wachtrij leeg is (voorkomt dat de
// Map oneindig groeit).
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  // Onze beurt komt pas nadat de vorige klaar is; de fout van de vorige negeren we bewust.
  const runAfterPrevious = previous.then(
    () => fn(),
    () => fn(),
  );
  // Registreer onze beurt als de nieuwe staart (fouten geneutraliseerd, puur als "wacht"-anker).
  const tail = runAfterPrevious.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);

  try {
    return await runAfterPrevious;
  } finally {
    // Alleen opruimen als niemand ná ons de staart heeft overgenomen — anders zou B's plek
    // verdwijnen terwijl B nog moet draaien.
    if (tails.get(key) === tail) {
      tails.delete(key);
    }
  }
}
